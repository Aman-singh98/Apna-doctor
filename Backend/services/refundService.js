// services/refundService.js
//
// Phase 6 (Cancellation & Refunds) — every code path that needs to give
// money back goes through here, same "one place wraps the decision, not
// re-implemented per call site" rule as services/razorpayService.js wraps
// the SDK itself. This module owns:
//   - idempotent refund issuance (task 31/33): a retried/duplicate cancel
//     request, or two flows racing to refund the same payment (e.g. the
//     app-driven slot-clash path and the payment.captured webhook safety
//     net both reacting to the same captured payment), must never double-
//     refund.
//   - the explicit Route-transfer void (task 32): "confirm the transfer
//     auto-voids on refund — test this, don't assume" is a live-account
//     testing task that can't be done from this codebase alone, so this
//     always issues an explicit holdTransfer() call defensively rather
//     than trusting Razorpay to auto-void. If a real Razorpay test-mode
//     account confirms the transfer already auto-voided by the time this
//     call runs, holdTransfer() erroring/no-op'ing here is an EXPECTED
//     outcome, not a bug — see the try/catch below.
//
// Two call shapes are supported:
//   - refundCapturedPayment(): a payment was captured but never produced
//     an Appointment/Transaction (the concurrent-slot-clash case, task 56)
//     — there's nothing on our side to update besides the gateway refund
//     itself.
//   - refundAppointment(): a real Appointment (+ Transaction) exists and
//     needs to be walked to a refunded state (patient cancellation, task 31;
//     doctor-side cancel/no-show, task 34).
//
// Neither function throws on a gateway-reported "already refunded" error —
// that is Razorpay's own idempotency signal telling us a previous attempt
// (or a racing request) already succeeded, and is treated as success here,
// not surfaced as a failure to the caller.

const razorpayService = require('./razorpayService');
const Transaction = require('../models/Transaction');
const { PAYMENT_STATUS, TRANSACTION_STATUS } = require('../constants/paymentConstants');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');

/**
 * Recognize Razorpay's "this payment has already been fully refunded"
 * error so a retried/racing refund call can be treated as an idempotent
 * success rather than a failure. Matched on the error description rather
 * than a status code alone, since Razorpay uses the same 400
 * BAD_REQUEST_ERROR shape for several distinct refund failure reasons.
 */
function isAlreadyRefundedError(err) {
	const description = String(err?.error?.description || err?.description || err?.message || '');
	return /already/i.test(description) && /refund/i.test(description);
}

/**
 * Issue a refund for a captured payment, idempotently. Never throws — a
 * hard gateway failure is reported back as `{ refunded: false, error: true }`
 * so the caller (whose real job — cancelling the slot / marking a no-show —
 * has already happened by the time this runs) can log/flag it for Phase 9
 * admin reconciliation instead of failing the whole cancellation.
 *
 * @param {Object} params
 * @param {String} params.paymentId - the captured Razorpay payment id
 * @param {String} [params.reason] - non-sensitive reason, stored in Razorpay's refund notes
 * @param {Object} [params.correlationIds] - orderId/appointmentId/etc for structured logging
 */
async function issueRefundIdempotent({ paymentId, reason, correlationIds = {} }) {
	if (!paymentId) {
		logSecurityEvent('refund.missing_payment_id', correlationIds, { reason });
		return { refunded: false, skipped: true };
	}
	try {
		const refund = await razorpayService.issueRefund({ paymentId, notes: { reason: reason || 'cancellation' } });
		logEvent('refund.issued', { ...correlationIds, paymentId }, { refundId: refund?.id, reason });
		return { refunded: true, refundId: refund?.id };
	} catch (err) {
		if (isAlreadyRefundedError(err)) {
			// Not our failure — a previous attempt (or a racing request) already
			// got there first. Per the idempotency standard, this is success.
			logEvent('refund.already_refunded_on_gateway', { ...correlationIds, paymentId }, { reason });
			return { refunded: true, alreadyRefunded: true };
		}
		logSecurityEvent('refund.issue_failed', { ...correlationIds, paymentId }, { reason, message: err.message });
		return { refunded: false, error: true, message: err.message };
	}
}

/**
 * Task 32 — explicitly void the Route transfer rather than assuming
 * Razorpay auto-voids it on refund. Best-effort: a failure here (including
 * "there's nothing to void, it's already gone") must never undo the refund
 * that already succeeded, so this only logs, never throws.
 */
async function voidTransferIfPresent(transaction, correlationIds = {}) {
	if (!transaction || !transaction.razorpayTransferId) return;
	try {
		await razorpayService.holdTransfer(transaction.razorpayTransferId);
		logEvent('refund.transfer_voided', { ...correlationIds, transferId: transaction.razorpayTransferId }, {});
	} catch (err) {
		// Expected in the case Razorpay already auto-voided the transfer on
		// refund (task 32's own open question) — logged for traceability,
		// not treated as an error that blocks anything downstream.
		logSecurityEvent(
			'refund.transfer_void_failed',
			{ ...correlationIds, transferId: transaction.razorpayTransferId },
			{ message: err.message }
		);
	}
}

/**
 * Refund a captured payment that never produced an Appointment/Transaction
 * — the concurrent-slot-clash case (Flow F / task 56): the payment
 * succeeded but this booking attempt lost the race for the slot to another
 * payment. There's no Route transfer yet at this point (transfers are only
 * created once an Appointment exists), so nothing to void — just the
 * gateway refund itself.
 *
 * @param {Object} params
 * @param {String} params.paymentId
 * @param {String} [params.reason]
 * @param {Object} [params.correlationIds]
 */
async function refundCapturedPayment({ paymentId, reason, correlationIds = {} }) {
	return issueRefundIdempotent({ paymentId, reason, correlationIds });
}

/**
 * Refund an Appointment's payment in full (Phase 6, tasks 31/33/34) —
 * patient-initiated cancellation, or doctor-side cancel/no-show. Callers
 * are expected to have already atomically transitioned the Appointment's
 * status (e.g. `findOneAndUpdate({ status: 'upcoming' }, { status: 'cancelled' })`)
 * before calling this, so that a retried cancel request can never reach
 * here twice for the same appointment — this function's own
 * paymentStatus-based check below is a defensive second layer, not the
 * primary idempotency guard.
 *
 * Mutates and saves `appointment` (sets paymentStatus) and the matching
 * Transaction (status + onHold) on success; leaves both untouched if the
 * gateway refund itself fails outright, so a failed refund is never
 * reported as one that succeeded.
 *
 * @param {Object} params
 * @param {import('mongoose').Document} params.appointment
 * @param {String} [params.reason]
 * @param {'patient'|'doctor'|'system'} [params.initiatedBy]
 */
async function refundAppointment({ appointment, reason, initiatedBy }) {
	const correlationIds = { appointmentId: String(appointment._id) };

	if (appointment.paymentStatus === PAYMENT_STATUS.REFUNDED) {
		logEvent('refund.appointment_already_refunded', correlationIds, { initiatedBy });
		return { refunded: false, alreadyRefunded: true };
	}
	if (appointment.paymentStatus !== PAYMENT_STATUS.PAID || !appointment.razorpayPaymentId) {
		// Legacy (pre-payment-integration) appointment, or one that was never
		// actually paid via Razorpay in the first place — nothing to refund
		// on the gateway. See models/Appointment.js's migration note: a
		// missing paymentStatus means "legacy, already confirmed," not
		// "unpaid," so this is not an error condition.
		logEvent('refund.appointment_no_payment_on_record', correlationIds, {
			initiatedBy,
			paymentStatus: appointment.paymentStatus,
		});
		return { refunded: false, skipped: true };
	}

	const result = await issueRefundIdempotent({
		paymentId: appointment.razorpayPaymentId,
		reason: reason || `${initiatedBy || 'system'} cancellation`,
		correlationIds,
	});

	if (!result.refunded) {
		// Gateway refund failed outright (not the idempotent-already-refunded
		// case) — leave paymentStatus as PAID rather than reporting a refund
		// that didn't happen. The cancellation itself still stands; this is
		// exactly the kind of gap Phase 9 admin manual-refund/reconciliation
		// exists to close.
		return result;
	}

	const transaction = await Transaction.findOne({ appointment: appointment._id });
	if (transaction) {
		await voidTransferIfPresent(transaction, correlationIds);
		transaction.onHold = true;
		transaction.status = TRANSACTION_STATUS.REFUNDED;
		await transaction.save();
	}

	appointment.paymentStatus = PAYMENT_STATUS.REFUNDED;
	await appointment.save();

	logEvent('refund.appointment_refunded', correlationIds, {
		initiatedBy,
		transactionId: transaction ? String(transaction._id) : undefined,
	});

	return { refunded: true, alreadyRefunded: Boolean(result.alreadyRefunded) };
}

module.exports = {
	refundCapturedPayment,
	refundAppointment,
	isAlreadyRefundedError,
};
