// constants/gstConstants.js
//
// GST configuration used by services/invoicePdfService.js and
// controllers/adminPaymentController.js when generating the Patient
// Receipt / Doctor Invoice / Admin Invoice for a payment.
//
// ── Why the two rates are different (plain-English, not tax advice) ───────
// • PATIENT RECEIPT — GST rate: 0%
//   Health-care services rendered by a doctor to a patient (consultation,
//   diagnosis, treatment) are exempt from GST in India under Notification
//   No. 12/2017-Central Tax (Rate), entry 74. That is why the patient-facing
//   receipt shows "GST @ 0%" rather than simply omitting GST — it records
//   that the exemption was considered, not missed.
//
// • DOCTOR INVOICE — GST rate: 18%
//   This invoice states the doctor's settlement amount for the consult
//   (see amounts.doctorShare) as a professional/facilitation fee and adds
//   18% GST on top of it — the general rate for professional/consultancy
//   services (SAC 9982/9983) when the supplier is GST-registered.
//   NOTE: a doctor's direct clinical service to a patient is itself
//   GST-exempt (same exemption as the patient receipt above); 18% here is
//   only appropriate if this document is meant to represent a separate
//   taxable professional/facilitation supply. This is a modelling choice,
//   not settled tax law — see point 1 below.
//
// ── IMPORTANT — please read before relying on this in production ─────────
// 1. This file encodes a reasonable starting default — it is NOT a
//    substitute for advice from a qualified Chartered Accountant / GST
//    practitioner. Before sending these to real patients/doctors, confirm
//    with them: the correct rate, the correct base amount, whether the
//    doctor invoice should even carry GST at all (given the exemption
//    noted above), and your exact SAC/HSN code.
// 2. GST can only be legally charged on an invoice if the issuing entity
//    (Apna Doctor Healthcare LLP) holds a valid GSTIN. Until GSTIN_NUMBER
//    below is filled in with a real, registered GSTIN, invoices render the
//    GST line for transparency but also print a clear
//    "GSTIN not yet registered — GST shown for reference only" notice, so
//    nothing is silently mis-declared as officially tax-compliant.
// 3. Keep this file as the single source of truth for these two rates —
//    don't hardcode "18" / "0" anywhere else.

const GST_RATES = Object.freeze({
   PATIENT_PCT: 0, // consultation fee — exempt healthcare service
   DOCTOR_PCT: 18, // platform commission/facilitation fee
});

// Fill this in with the real GSTIN once Apna Doctor Healthcare LLP is
// GST-registered. Leave null until then — see note (2) above.
const GSTIN_NUMBER = null;

// Placeholder SAC (Services Accounting Code) — confirm with your CA.
// 9985 = Support services; some platforms use 9997 (Other services) or a
// more specific health-tech code. Do not treat this as final.
const SAC_CODE = '9985';

function calculateGst(baseAmount, pct) {
   if (baseAmount == null) return null;
   const amount = Math.round((baseAmount * pct) / 100 * 100) / 100; // round to paise
   return amount;
}

module.exports = {
   GST_RATES,
   GSTIN_NUMBER,
   SAC_CODE,
   calculateGst,
};
