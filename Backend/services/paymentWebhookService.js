// services/paymentWebhookService.js
//
// Phase 4 webhook handlers that don't belong to the KYC/account.* family
// (that's services/doctorPayoutService.js) — dispatched from
// controllers/webhookController.js AFTER signature verification and
// event-id dedupe (models/WebhookEvent.js) have already happened. None of
// these functions re-verify either; they trust they're only ever invoked
// for a signed, first-delivery event.
//
// - handlePaymentCapturedEvent (task 22): safety net — creates the
//   Appointment (+ Transaction + Route transfer) if the app-driven
//   confirmation call never arrived (Flow E: app crash mid-Checkout-success).
// - handlePaymentFailedEvent (task 23): a failed payment never created an
//   Appointment (Flow F) — no-op on the booking, but cleans up the dead
//   PendingPaymentOrder and logs for traceability.
// - handleTransferProcessedEvent (task 24): mirrors a Route transfer's
//   settled/on_hold state onto the matching Transaction.
//
// Money/identity fields for the safety-net path are resolved from
// PendingPaymentOrder (server-computed at order-creation time,
// patientAppointmentController.createOrder) — the same authoritative
// source the app-driven path uses. If that record has already expired
// (30-min TTL) by the time a webhook lands, payment.captured falls back to
// the order's own `notes`, set server-side at the same moment for exactly
// this reason. Nothing here is ever taken from what Razorpay reports as
// the payment amount, or from anything else client-controlled.

const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const FamilyMember = require('../models/FamilyMember');
const Transaction = require('../models/Transaction');
const PendingPaymentOrder = require('../models/PendingPaymentOrder');
const razorpayService = require('./razorpayService');
const refundService = require('./refundService');
const { notify } = require('../utils/notify');
const { getFeesForCategory, getSplitForCategory } = require('../config/doctorFeeConfig');
const { PAYMENT_STATUS, TRANSACTION_STATUS } = require('../constants/paymentConstants');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');

const TYPE_TO_FEE_KEY = { Video: 'video', Audio: 'audio', Chat: 'chat' };

/**
 * Handle a `payment.captured` webhook event: create the Appointment (+
 * Transaction + Route transfer) if the app-driven path hasn't already done
 * so for this order. No-ops safely if it has.
 *
 * @param {Object} params
 * @param {Object} params.paymentEntity - `event.payload.payment.entity` from the webhook body
 * @returns {Promise<{ handled: Boolean, created: Boolean, appointmentId?: String, slotClash?: Boolean }>}
 */
async function handlePaymentCapturedEvent({ paymentEntity }) {
	const orderId = paymentEntity && paymentEntity.order_id;
	const paymentId = paymentEntity && paymentEntity.id;

	if (!orderId || !paymentId) {
		logSecurityEvent('webhook.payment_captured.missing_ids', {}, {});
		return { handled: false, created: false };
	}

	// Already booked — either the app-driven path won the race, or (should
	// never happen given WebhookEvent dedupe, but cheap to guard) a prior
	// delivery of this same signal already created it. The DB's unique
	// index on razorpayOrderId is the final backstop below if this read and
	// an in-flight createAppointment call race each other.
	const existing = await Appointment.findOne({ razorpayOrderId: orderId });
	if (existing) {
		logEvent('webhook.payment_captured.appointment_exists', { orderId, paymentId, appointmentId: String(existing._id) });
		return { handled: true, created: false, appointmentId: existing._id };
	}

	const pendingOrder = await PendingPaymentOrder.findOne({ razorpayOrderId: orderId });

	// Resolve identity/slot fields, preferring PendingPaymentOrder and
	// falling back to the order's own `notes` if that record has expired.
	const notes = paymentEntity.notes || {};
	const doctorId = pendingOrder ? String(pendingOrder.doctor) : notes.doctorId;
	const patientId = pendingOrder ? String(pendingOrder.patient) : notes.patientId;
	const type = pendingOrder ? pendingOrder.type : notes.type;
	const familyMemberId = pendingOrder
		? pendingOrder.familyMember
			? String(pendingOrder.familyMember)
			: null
		: notes.familyMemberId || null;
	const dateRaw = pendingOrder ? pendingOrder.date : notes.date;

	if (!doctorId || !patientId || !type || !dateRaw) {
		logSecurityEvent(
			'webhook.payment_captured.unrecoverable',
			{ orderId, paymentId },
			{
				hasPendingOrder: Boolean(pendingOrder),
				hasDoctorId: Boolean(doctorId),
				hasPatientId: Boolean(patientId),
				hasType: Boolean(type),
				hasDate: Boolean(dateRaw),
			}
		);
		return { handled: false, created: false };
	}

	const apptDate = new Date(dateRaw);
	if (isNaN(apptDate.getTime())) {
		logSecurityEvent('webhook.payment_captured.invalid_date', { orderId, paymentId }, {});
		return { handled: false, created: false };
	}

	// select('+razorpayAccountId'): that field is `select: false` on the
	// Doctor schema by default (see models/Doctor.js) — must opt back in
	// explicitly to know whether a Route transfer can be created below.
	const doctor = await Doctor.findOne({ _id: doctorId, approvalStatus: 'approved' }).select('+razorpayAccountId');
	if (!doctor) {
		logSecurityEvent('webhook.payment_captured.doctor_not_found', { orderId, paymentId }, { doctorId });
		return { handled: false, created: false };
	}

	let familyMember = null;
	let patientName;
	if (familyMemberId) {
		familyMember = await FamilyMember.findOne({ _id: familyMemberId, patient: patientId });
	}
	if (familyMember) {
		patientName = familyMember.name;
	} else {
		const patient = await Patient.findById(patientId);
		if (!patient) {
			logSecurityEvent('webhook.payment_captured.patient_not_found', { orderId, paymentId }, { patientId });
			return { handled: false, created: false };
		}
		patientName = patient.name;
	}

	// Amounts: prefer the figures fixed server-side at order-creation time.
	// Only recompute from doctorFeeConfig.js directly if PendingPaymentOrder
	// is gone — still fully server-derived, never from anything Razorpay or
	// a client reports as "amount paid" (see file header).
	let totalAmount;
	let doctorAmount;
	let platformAmount;
	if (pendingOrder) {
		({ totalAmount, doctorAmount, platformAmount } = pendingOrder);
	} else {
		const feeKey = TYPE_TO_FEE_KEY[type];
		const fees = getFeesForCategory(doctor.category);
		const split = getSplitForCategory(doctor.category);
		totalAmount = feeKey ? fees[feeKey] : 0;
		if (!totalAmount || !split) {
			logSecurityEvent('webhook.payment_captured.fee_unresolvable', { orderId, paymentId }, { doctorId, type });
			return { handled: false, created: false };
		}
		doctorAmount = Math.round(((totalAmount * split.doctor) / 100) * 100) / 100;
		platformAmount = Math.round((totalAmount - doctorAmount) * 100) / 100;
		logEvent('webhook.payment_captured.recomputed_amount_fallback', { orderId, paymentId }, { doctorId, type });
	}

	// Same slot-clash rule as the app-driven path (Flow F): whichever
	// booking wins the slot keeps it. Phase 6, task 56: the loser now gets
	// refunded here too — refundService's idempotent refund means this is
	// safe even if the app-driven path (patientAppointmentController) reacts
	// to the very same clash concurrently and refunds first.
	const clash = await Appointment.findOne({ doctor: doctor._id, date: apptDate, status: 'upcoming' });
	if (clash) {
		logEvent('webhook.payment_captured.slot_clash', { orderId, paymentId }, { doctorId: String(doctor._id) });
		const refundResult = await refundService.refundCapturedPayment({
			paymentId,
			reason: 'slot_clash',
			correlationIds: { orderId },
		});
		if (pendingOrder) {
			await PendingPaymentOrder.deleteOne({ _id: pendingOrder._id }).catch(() => {});
		}
		return { handled: true, created: false, slotClash: true, refunded: refundResult.refunded };
	}

	let appointment;
	try {
		appointment = await Appointment.create({
			doctor: doctor._id,
			patient: patientId,
			familyMember: familyMember ? familyMember._id : null,
			patientName,
			date: apptDate,
			type,
			status: 'upcoming',
			fee: totalAmount,
			razorpayOrderId: orderId,
			razorpayPaymentId: paymentId,
			paymentStatus: PAYMENT_STATUS.PAID,
		});
	} catch (err) {
		// Unique-index race with a concurrently-landing app-driven request —
		// whoever loses just reports the winner's Appointment instead of
		// erroring, same pattern as patientAppointmentController.createAppointment.
		if (err.code === 11000) {
			const winner = await Appointment.findOne({ razorpayOrderId: orderId });
			if (winner) {
				logEvent('webhook.payment_captured.race_lost_to_app_path', {
					orderId,
					paymentId,
					appointmentId: String(winner._id),
				});
				return { handled: true, created: false, appointmentId: winner._id };
			}
		}
		throw err;
	}

	// Route transfer, held until consultation completion (Phase 5), same
	// best-effort handling as the app-driven path: a transfer failure must
	// never undo an already-captured, already-booked appointment.
	let transaction;
	if (doctor.razorpayAccountId) {
		try {
			const transfer = await razorpayService.createRouteTransfer({
				paymentId,
				doctorAccountId: doctor.razorpayAccountId,
				amountInRupees: doctorAmount,
				onHold: true,
			});
			transaction = await Transaction.create({
				doctor: doctor._id,
				appointment: appointment._id,
				amount: doctorAmount,
				status: TRANSACTION_STATUS.PENDING,
				razorpayTransferId: transfer.id,
				platformAmount,
				onHold: true,
			});
			logEvent('webhook.payment_captured.transfer_created', {
				orderId,
				paymentId,
				transferId: transfer.id,
				appointmentId: String(appointment._id),
			});
		} catch (err) {
			logSecurityEvent(
				'webhook.payment_captured.transfer_create_failed',
				{ orderId, paymentId, appointmentId: String(appointment._id) },
				{ message: err.message }
			);
			transaction = await Transaction.create({
				doctor: doctor._id,
				appointment: appointment._id,
				amount: doctorAmount,
				status: TRANSACTION_STATUS.PENDING,
				platformAmount,
				onHold: true,
			});
		}
	} else {
		logEvent(
			'webhook.payment_captured.transfer_skipped_no_linked_account',
			{ orderId, appointmentId: String(appointment._id) },
			{ doctorId: String(doctor._id) }
		);
		transaction = await Transaction.create({
			doctor: doctor._id,
			appointment: appointment._id,
			amount: doctorAmount,
			status: TRANSACTION_STATUS.PENDING,
			platformAmount,
			onHold: true,
		});
	}

	if (pendingOrder) {
		await PendingPaymentOrder.deleteOne({ _id: pendingOrder._id }).catch(() => {});
	}

	// Security-level, not just info: this path only ever runs when the
	// normal app-driven confirmation never arrived. It's the intended
	// safety net working as designed, not an attack — but an unusually
	// high rate of these is exactly the kind of "webhook processing"
	// signal the engineering standards doc asks to alert on, since it
	// likely means something upstream (app crashes, connectivity) is
	// degraded even though no booking was lost.
	logSecurityEvent(
		'webhook.payment_captured.safety_net_created_appointment',
		{ orderId, paymentId, appointmentId: String(appointment._id) },
		{ doctorId: String(doctor._id), viaFallbackNotes: !pendingOrder }
	);

	await notify({
		recipientId: doctor._id,
		recipientRole: 'doctor',
		type: 'appointment',
		title: 'New Appointment Booked',
		desc: `${patientName} booked a ${type} consultation with you.`,
		meta: { appointmentId: appointment._id },
	});

	return { handled: true, created: true, appointmentId: appointment._id };
}

/**
 * Handle a `payment.failed` webhook event (Phase 4, task 23).
 *
 * Per Flow F, a failed Checkout payment never creates an Appointment in the
 * first place — the app-driven path (patientAppointmentController) only
 * ever creates one after a *verified* signature, and a failed payment
 * never produces one. So there's no booking to undo here; this handler's
 * job is (a) confirm that's still true, (b) log the failure for support
 * traceability, and (c) clean up the now-dead PendingPaymentOrder so a
 * retry for the same (patient, doctor, type, date) mints a fresh order per
 * Flow F, instead of createOrder's idempotency check handing back this
 * failed one.
 *
 * @param {Object} params
 * @param {Object} params.paymentEntity - `event.payload.payment.entity`
 * @returns {Promise<{ handled: Boolean }>}
 */
async function handlePaymentFailedEvent({ paymentEntity }) {
	const orderId = paymentEntity && paymentEntity.order_id;
	const paymentId = paymentEntity && paymentEntity.id;
	const errorCode = paymentEntity && paymentEntity.error_code;
	const errorDescription = paymentEntity && paymentEntity.error_description;

	if (!orderId) {
		logSecurityEvent('webhook.payment_failed.missing_order_id', {}, { paymentId });
		return { handled: false };
	}

	// Defensive only — should never actually find one, since a failed
	// payment's signature was never verified and so never created an
	// Appointment. If it somehow did (e.g. a different, later payment on
	// the same order succeeded), there's nothing to undo; just note it.
	const existing = await Appointment.findOne({ razorpayOrderId: orderId });
	if (existing) {
		logEvent('webhook.payment_failed.appointment_already_exists', {
			orderId,
			paymentId,
			appointmentId: String(existing._id),
		});
		return { handled: true };
	}

	// Clean up so a retry doesn't get handed back this dead order. NOTE:
	// this still leaves a narrow window where a client retries fast enough
	// to hit createOrder's idempotency check before this async webhook
	// lands — fully closing that requires Phase 7's retry UI to signal the
	// failure to the backend directly rather than relying solely on this
	// webhook. TTL (30 min) is the final backstop either way.
	const pendingOrder = await PendingPaymentOrder.findOne({ razorpayOrderId: orderId });
	if (pendingOrder) {
		await PendingPaymentOrder.deleteOne({ _id: pendingOrder._id }).catch(() => {});
	}

	// Per Flow F, no raw gateway decline reason ever reaches a user-facing
	// response — but this IS the server-side log that rule explicitly
	// carves out ("detailed reasons logged server-side only"), and the
	// code-quality bar asks for every payment event to be logged with
	// correlation ids, so log it plainly here.
	logEvent(
		'webhook.payment_failed',
		{ orderId, paymentId },
		{ errorCode, errorDescription, hadPendingOrder: Boolean(pendingOrder) }
	);

	return { handled: true };
}

/**
 * Handle a `transfer.processed` webhook event (Phase 4, task 24).
 *
 * This is Razorpay's own confirmation that a Route transfer settled,
 * independent of whatever triggered its release on our side (Phase 5's
 * consultation-completion flow). Mirrors the transfer's on_hold state onto
 * Transaction.onHold (per that field's own doc comment) and — the same
 * "pending → credited" transition Phase 5 task 28 performs on completion —
 * moves the Transaction to credited if it's still pending and the transfer
 * is no longer on hold. Never overwrites `failed`/`refunded`, since those
 * reflect a more specific event on our side than this generic signal.
 *
 * @param {Object} params
 * @param {Object} params.transferEntity - `event.payload.transfer.entity`
 * @returns {Promise<{ handled: Boolean, changed?: Boolean, transactionId?: String }>}
 */
async function handleTransferProcessedEvent({ transferEntity }) {
	const transferId = transferEntity && transferEntity.id;
	if (!transferId) {
		logSecurityEvent('webhook.transfer_processed.missing_transfer_id', {}, {});
		return { handled: false };
	}

	const transaction = await Transaction.findOne({ razorpayTransferId: transferId });
	if (!transaction) {
		// Can legitimately happen — e.g. a transfer created by Admin manual
		// reconciliation (Phase 9) that isn't tied to a Transaction the same
		// way, or this webhook racing the write that sets
		// razorpayTransferId in the first place. Log, don't throw: a 5xx
		// here just makes Razorpay retry forever for an event we may never
		// be able to attach anywhere.
		logSecurityEvent('webhook.transfer_processed.unrecognized_transfer', { transferId }, {});
		return { handled: false };
	}

	const onHold = Boolean(transferEntity.on_hold);
	const previousStatus = transaction.status;
	let changed = false;

	if (transaction.onHold !== onHold) {
		transaction.onHold = onHold;
		changed = true;
	}

	if (!onHold && transaction.status === TRANSACTION_STATUS.PENDING) {
		transaction.status = TRANSACTION_STATUS.CREDITED;
		changed = true;
	}

	if (changed) {
		await transaction.save();
	}

	logEvent(
		'webhook.transfer_processed',
		{ transferId, appointmentId: transaction.appointment ? String(transaction.appointment) : undefined },
		{ previousStatus, newStatus: transaction.status, onHold, changed }
	);

	return { handled: true, changed, transactionId: transaction._id };
}

module.exports = { handlePaymentCapturedEvent, handlePaymentFailedEvent, handleTransferProcessedEvent };
