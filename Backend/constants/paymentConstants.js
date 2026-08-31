// constants/paymentConstants.js
//
// Single source of truth for payment-related status enums used across the
// backend (models, controllers, webhook handler) and mirrored in the Admin
// app at Admin/src/utils/paymentConstants.js — see that file's header for
// why it can't literally `require()` this one (separate app/deploy), and
// keep the two in sync manually, same pattern as doctorFeeConfig.js /
// constants/doctorFees.js.
//
// Do not use raw string literals for these statuses anywhere in the
// codebase — import from here instead, so schema and any UI reading these
// values can never drift.

// Doctor.payoutStatus — Razorpay Route linked-account KYC state (Phase 3).
const PAYOUT_STATUS = Object.freeze({
	NOT_STARTED: 'not_started',
	PENDING_VERIFICATION: 'pending_verification',
	ACTIVE: 'active',
});
const PAYOUT_STATUS_VALUES = Object.values(PAYOUT_STATUS);

// Appointment.paymentStatus — state of the patient's payment for a booking.
// NOTE: because a failed payment never creates an Appointment (see Flow F),
// 'failed' here only ever applies to the rare post-creation reconciliation
// case, not to an ordinary Checkout failure.
const PAYMENT_STATUS = Object.freeze({
	PENDING: 'pending',
	PAID: 'paid',
	REFUNDED: 'refunded',
	FAILED: 'failed',
});
const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

// Transaction.status — state of the doctor's share / Route transfer.
const TRANSACTION_STATUS = Object.freeze({
	PENDING: 'pending',
	CREDITED: 'credited',
	FAILED: 'failed',
	REFUNDED: 'refunded',
});
const TRANSACTION_STATUS_VALUES = Object.values(TRANSACTION_STATUS);

module.exports = {
	PAYOUT_STATUS,
	PAYOUT_STATUS_VALUES,
	PAYMENT_STATUS,
	PAYMENT_STATUS_VALUES,
	TRANSACTION_STATUS,
	TRANSACTION_STATUS_VALUES,
};
