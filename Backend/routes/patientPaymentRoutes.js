// ─── Payments & Billing Routes (Patient-facing) ────────────────────────────
// All routes require a valid PATIENT JWT (patientProtect middleware).
// Scoped to the logged-in patient only — every query filters by req.user.id.
//
// GET  /api/patient/payments                → payment history (paid/refunded/pending)
// GET  /api/patient/payments/summary         → total spent + counts
// GET  /api/patient/payments/refunds         → refund history
// GET  /api/patient/payments/:id/invoice/pdf → download receipt PDF
//
// Refunding a payment is NOT done here — that only happens as a side effect
// of PATCH /api/patient/appointments/:id/cancel (see
// controllers/patientAppointmentController.js), which is the one and only
// place in this codebase that can move money back to a patient.

const express = require('express');
const {
   getPaymentSummary,
   listPayments,
   listRefunds,
   downloadInvoicePdf,
} = require('../controllers/patientPaymentController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

// Must be registered before '/:id/...' so Express doesn't treat "summary"/"refunds" as an id
router.get('/summary', getPaymentSummary);
router.get('/refunds', listRefunds);
router.get('/', listPayments);
router.get('/:id/invoice/pdf', downloadInvoicePdf);

module.exports = router;
