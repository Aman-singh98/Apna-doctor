// ─── Payment Routes (Admin-facing) ─────────────────────────────────────────
// No auth middleware yet — matches the current state of routes/admin.js and
// routes/adminAppointmentRoutes.js. Add an adminAuth middleware here once
// admin login exists, the same way you'll add it to those files.
//
//   const adminAuth = require('../middleware/adminAuth');
//   router.use(adminAuth);
//
// GET   /api/admin/payments        → list (filters: ?status=&search=&page=&limit=)
// GET   /api/admin/payments/stats  → counts by status + total collected
// GET   /api/admin/payments/:id    → single payment (Appointment) detail
// PATCH /api/admin/payments/:id/refund → issue a refund (body: { reason })

const express = require('express');
const {
   listPayments,
   getPaymentStats,
   getPaymentById,
   refundPayment,
} = require('../controllers/adminPaymentController');

const router = express.Router();

// NOTE: /stats must be defined BEFORE /:id so Express doesn't treat "stats" as an id
router.get('/stats', getPaymentStats);
router.get('/', listPayments);
router.get('/:id', getPaymentById);
router.patch('/:id/refund', refundPayment);

module.exports = router;
