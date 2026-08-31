// services/doctorPayoutService.js
//
// Phase 3, tasks 17-18: on admin approval, create the doctor's Razorpay
// Route linked account from their PAN/bank/UPI/business KYC, store the
// returned razorpayAccountId, and flip payoutStatus to
// pending_verification. This file is the orchestration layer between the
// Doctor model and the raw Razorpay SDK calls in razorpayService.js — it
// owns the "what to do" (fetch KYC, decide bank vs UPI, update the
// document, log, handle failure) while razorpayService.js owns only "how
// to call Razorpay."
//
// This is deliberately called from controllers/doctorController.js's
// verifyDoctor as a best-effort step: a Razorpay failure here must NEVER
// block or roll back the admin's approval decision (the doctor is still
// approved and can take consultations; payouts just aren't wired up yet).
// It's also exposed as a standalone retry (routes/doctorRoutes.js
// `POST /:id/payout-account`) for the admin to re-trigger after the doctor
// fixes/re-submits KYC, without re-running the whole approval flow.
//
// SECURITY: this file must never log PAN, bank account number, or UPI ID —
// only ids and statuses. See utils/paymentLogger.js's own warning to the
// same effect.

const Doctor = require('../models/Doctor');
const razorpayService = require('../services/razorpayService');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');
const { PAYOUT_STATUS } = require('../constants/paymentConstants');

class PayoutProvisioningError extends Error {
	constructor(message, { code, cause } = {}) {
		super(message);
		this.name = 'PayoutProvisioningError';
		this.code = code || 'PAYOUT_PROVISIONING_FAILED';
		this.cause = cause;
	}
}

/**
 * Create (or re-attempt) the doctor's Razorpay Route linked account.
 * Idempotent: if the doctor already has an active/pending razorpayAccountId,
 * this is a no-op that returns the existing state rather than creating a
 * duplicate account on Razorpay.
 *
 * @param {String} doctorId
 * @returns {Promise<{ status: 'already_active'|'already_pending'|'provisioned', payoutStatus: String, razorpayAccountId: String|null }>}
 * @throws {PayoutProvisioningError} if KYC is missing or the Razorpay calls fail
 */
async function provisionPayoutAccount(doctorId) {
	const doctor = await Doctor.findByIdWithPayoutKyc(doctorId);
	if (!doctor) {
		throw new PayoutProvisioningError('Doctor not found.', { code: 'DOCTOR_NOT_FOUND' });
	}

	if (doctor.payoutStatus === PAYOUT_STATUS.ACTIVE) {
		return { status: 'already_active', payoutStatus: doctor.payoutStatus, razorpayAccountId: doctor.razorpayAccountId || null };
	}
	if (doctor.razorpayAccountId) {
		// Already have a linked account from a prior attempt (e.g. sitting in
		// pending_verification awaiting Razorpay's async KYC check, Phase 3
		// task 20) — don't create a second one.
		return {
			status: 'already_pending',
			payoutStatus: doctor.payoutStatus,
			razorpayAccountId: doctor.razorpayAccountId,
		};
	}

	if (!doctor.hasSubmittedPayoutKyc()) {
		throw new PayoutProvisioningError(
			'Doctor has not submitted PAN/bank-or-UPI/business KYC yet — cannot create a Razorpay linked account.',
			{ code: 'KYC_INCOMPLETE' }
		);
	}

	const kyc = doctor.getDecryptedPayoutKyc();

	try {
		const account = await razorpayService.createLinkedAccount({
			email: kyc.contactEmail,
			phone: doctor.phone,
			legalBusinessName: kyc.legalBusinessName,
			businessType: kyc.businessType,
			contactName: doctor.name || kyc.legalBusinessName,
			pan: kyc.pan,
		});

		await razorpayService.createStakeholder(account.id, {
			name: doctor.name || kyc.legalBusinessName,
			email: kyc.contactEmail,
			pan: kyc.pan,
		});

		await razorpayService.requestRouteProductConfig(account.id, {
			bankAccount: kyc.bankAccountNumber
				? {
						accountNumber: kyc.bankAccountNumber,
						ifscCode: kyc.ifscCode,
						beneficiaryName: doctor.name || kyc.legalBusinessName,
					}
				: undefined,
			vpa: !kyc.bankAccountNumber ? kyc.upiId : undefined,
		});

		doctor.razorpayAccountId = account.id;
		doctor.payoutStatus = PAYOUT_STATUS.PENDING_VERIFICATION;
		await doctor.save();

		// Correlation ids and non-sensitive metadata only — never pan/bank/upi.
		logEvent(
			'doctor_payout_account.created',
			{ doctorId: String(doctor._id), razorpayAccountId: account.id },
			{ payoutStatus: doctor.payoutStatus }
		);

		return { status: 'provisioned', payoutStatus: doctor.payoutStatus, razorpayAccountId: account.id };
	} catch (err) {
		// Leave payoutStatus as-is (not_started) so the admin can see
		// "approved but payout setup pending/failed" (Phase 9, task 50) and
		// retry via POST /api/doctors/:id/payout-account once fixed.
		logSecurityEvent(
			'doctor_payout_account.provisioning_failed',
			{ doctorId: String(doctor._id) },
			{ reason: err.message }
		);
		throw new PayoutProvisioningError('Failed to create Razorpay linked account for doctor.', {
			code: 'RAZORPAY_CALL_FAILED',
			cause: err,
		});
	}
}

// Razorpay account-onboarding webhook event names that mean "KYC is fully
// done, this account can now receive live transfers." Route accounts can
// also reach 'activated_kyc_pending' (partially activated — can receive
// funds but can't withdraw yet) and 'instantly_activated' (same as
// activated for onboarding purposes here); both are treated as fully
// active for our purposes since either state is enough for a Route
// transfer to succeed. Re-verify this set against current Razorpay Route
// docs periodically — Razorpay has changed account-event naming before.
const ACCOUNT_ACTIVATED_EVENTS = new Set(['account.activated', 'account.instantly_activated', 'account.activated_kyc_pending']);

// Events that mean KYC needs more from the doctor, or was refused. There's
// no payoutStatus enum value for "failed"/"needs action" today (Phase 3
// only defined not_started/pending_verification/active) — rather than
// silently drop this information, log it as a security-relevant event so
// it surfaces in monitoring, and leave payoutStatus at pending_verification
// so the admin's existing "approved but payout setup pending" view (Phase
// 9, task 50) keeps showing it as unresolved rather than misreporting it
// as either done or untouched.
const ACCOUNT_NEEDS_ATTENTION_EVENTS = new Set([
	'account.needs_clarification',
	'account.rejected',
	'account.suspended',
	'account.under_review',
]);

/**
 * Phase 3, task 20 — apply the outcome of an async Razorpay Route account
 * KYC webhook event to the matching Doctor.
 *
 * Idempotent by design: flipping payoutStatus to ACTIVE (or leaving it at
 * pending_verification) is safe to run more than once for the same
 * account — this function does not itself dedupe by event id, that's the
 * webhook controller's job (see models/WebhookEvent.js) since dedupe must
 * happen before ANY handler runs, not per-handler.
 *
 * @param {Object} params
 * @param {String} params.eventType - e.g. 'account.activated'
 * @param {String} params.razorpayAccountId - Razorpay's `acc_...` id from the payload
 * @returns {Promise<{ handled: Boolean, doctorId: String|null, payoutStatus: String|null }>}
 */
async function handleAccountWebhookEvent({ eventType, razorpayAccountId }) {
	if (!razorpayAccountId) {
		logSecurityEvent('doctor_payout_account.webhook_missing_account_id', {}, { eventType });
		return { handled: false, doctorId: null, payoutStatus: null };
	}

	const doctor = await Doctor.findByRazorpayAccountId(razorpayAccountId);
	if (!doctor) {
		// Can legitimately happen if Razorpay's webhook is registered before
		// every existing account has been backfilled, or for an account this
		// system never created — log, don't throw (a 5xx here would make
		// Razorpay retry forever for an event we can never resolve).
		logSecurityEvent('doctor_payout_account.webhook_unrecognized_account', { razorpayAccountId }, { eventType });
		return { handled: false, doctorId: null, payoutStatus: null };
	}

	if (ACCOUNT_ACTIVATED_EVENTS.has(eventType)) {
		if (doctor.payoutStatus !== PAYOUT_STATUS.ACTIVE) {
			doctor.payoutStatus = PAYOUT_STATUS.ACTIVE;
			await doctor.save();
		}
		logEvent(
			'doctor_payout_account.activated',
			{ doctorId: String(doctor._id), razorpayAccountId },
			{ eventType, payoutStatus: doctor.payoutStatus }
		);
		return { handled: true, doctorId: String(doctor._id), payoutStatus: doctor.payoutStatus };
	}

	if (ACCOUNT_NEEDS_ATTENTION_EVENTS.has(eventType)) {
		logSecurityEvent(
			'doctor_payout_account.needs_attention',
			{ doctorId: String(doctor._id), razorpayAccountId },
			{ eventType, payoutStatus: doctor.payoutStatus }
		);
		return { handled: true, doctorId: String(doctor._id), payoutStatus: doctor.payoutStatus };
	}

	// Some other account.* event we don't act on (e.g. account.updated) —
	// log for traceability, but there's nothing to change.
	logEvent('doctor_payout_account.webhook_ignored', { doctorId: String(doctor._id), razorpayAccountId }, { eventType });
	return { handled: false, doctorId: String(doctor._id), payoutStatus: doctor.payoutStatus };
}

module.exports = {
	provisionPayoutAccount,
	PayoutProvisioningError,
	handleAccountWebhookEvent,
	ACCOUNT_ACTIVATED_EVENTS,
	ACCOUNT_NEEDS_ATTENTION_EVENTS,
};
