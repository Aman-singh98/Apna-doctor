// ─── Appointment Routes (Admin-facing) ────────────────────────────────────────
// No auth middleware yet — matches the current state of routes/admin.js and
// routes/patient/adminPatientRoutes.js. Add an adminAuth middleware here once
// admin login exists, the same way you'll add it to those files.
//
//   const adminAuth = require('../middleware/adminAuth');
//   router.use(adminAuth);
//
// GET   /api/admin/appointments        → list (filters: ?status=&search=&page=&limit=)
// GET   /api/admin/appointments/stats  → counts by status
// GET   /api/admin/appointments/:id    → single appointment detail
// PATCH /api/admin/appointments/:id/cancel → cancel (body: { reason })

const express = require('express');
const {
   listAppointments,
   getAppointmentStats,
   getAppointmentById,
   cancelAppointment,
} = require('../controllers/adminAppointmentController');

const router = express.Router();

// NOTE: /stats must be defined BEFORE /:id so Express doesn't treat "stats" as an id
router.get('/stats', getAppointmentStats);
router.get('/', listAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/cancel', cancelAppointment);

module.exports = router;
