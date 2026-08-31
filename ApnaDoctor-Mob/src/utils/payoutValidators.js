// utils/payoutValidators.js
//
// Client-side validation for the payout KYC fields collected in
// doctor-signup.js (PAN, bank account/UPI, business details — Phase 3,
// task 19). These are INTENTIONALLY kept byte-for-byte identical to the
// server-side rules in Backend/controllers/doctorMeController.js
// (submitPayoutKyc) — client validation here is a UX nicety (fail fast,
// no round-trip), the server-side check is the real security boundary and
// must never be trusted away. If you change a rule here, change it there
// too, and vice versa.

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_REGEX = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;
export const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BUSINESS_TYPES = [
   { key: 'individual', label: 'Individual' },
   { key: 'proprietorship', label: 'Proprietorship' },
];

/**
 * Validates the payout KYC form fields.
 *
 * @param {Object} fields
 * @param {String} fields.pan
 * @param {String} fields.legalBusinessName
 * @param {String} fields.businessType - 'individual' | 'proprietorship'
 * @param {String} fields.contactEmail
 * @param {'bank'|'upi'} fields.payoutMethod
 * @param {String} [fields.bankAccountNumber]
 * @param {String} [fields.confirmBankAccountNumber]
 * @param {String} [fields.ifscCode]
 * @param {String} [fields.upiId]
 * @returns {Object} errors keyed by field name — empty object means valid
 */
export function validatePayoutKyc({
   pan,
   legalBusinessName,
   businessType,
   contactEmail,
   payoutMethod,
   bankAccountNumber,
   confirmBankAccountNumber,
   ifscCode,
   upiId,
}) {
   const errors = {};

   if (!pan || !PAN_REGEX.test(String(pan).toUpperCase().trim())) {
      errors.pan = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
   }
   if (!legalBusinessName || !legalBusinessName.trim()) {
      errors.legalBusinessName = 'Business / payee name is required.';
   }
   if (!businessType || !BUSINESS_TYPES.some(b => b.key === businessType)) {
      errors.businessType = 'Select a business type.';
   }
   if (!contactEmail || !EMAIL_REGEX.test(contactEmail.trim())) {
      errors.contactEmail = 'Enter a valid email address for payout communication.';
   }

   if (payoutMethod === 'upi') {
      if (!upiId || !UPI_REGEX.test(upiId.trim())) {
         errors.upiId = 'Enter a valid UPI ID (e.g. name@bank).';
      }
   } else {
      if (!bankAccountNumber || !BANK_ACCOUNT_REGEX.test(bankAccountNumber.trim())) {
         errors.bankAccountNumber = 'Enter a valid bank account number (9-18 digits).';
      } else if (bankAccountNumber !== confirmBankAccountNumber) {
         errors.confirmBankAccountNumber = 'Account numbers do not match.';
      }
      if (!ifscCode || !IFSC_REGEX.test(ifscCode.toUpperCase().trim())) {
         errors.ifscCode = 'Enter a valid IFSC code (e.g. HDFC0001234).';
      }
   }

   return errors;
}
