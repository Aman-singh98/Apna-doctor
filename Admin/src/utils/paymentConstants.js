// src/utils/paymentConstants.js
//
// Mirror of Backend/constants/paymentConstants.js.
// ⚠️ Keep these two files in sync manually — if a status value changes or is
// added on the backend, update this file too (and vice versa). Same pattern
// as config/doctorFeeConfig.js ↔ constants/doctorFees.js already used in
// this codebase.
//
// Import these anywhere the Admin app reads/displays payment-related status
// (PaymentsPage, DoctorsPage payout-status flag, etc) instead of using raw
// string literals, so schema and UI never drift.

export const PAYOUT_STATUS = Object.freeze({
	NOT_STARTED: 'not_started',
	PENDING_VERIFICATION: 'pending_verification',
	ACTIVE: 'active',
});

export const PAYMENT_STATUS = Object.freeze({
	PENDING: 'pending',
	PAID: 'paid',
	REFUNDED: 'refunded',
	FAILED: 'failed',
});

export const TRANSACTION_STATUS = Object.freeze({
	PENDING: 'pending',
	CREDITED: 'credited',
	FAILED: 'failed',
	REFUNDED: 'refunded',
});
