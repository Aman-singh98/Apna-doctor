// ─── Appointment Routes (Patient-facing) ──────────────────────────────────────
// All routes require a valid PATIENT JWT (patientProtect middleware).
// Scoped to the logged-in patient only — every query filters by req.user.id.
//
// GET   /api/patient/appointments               → list patient's appointments
// POST  /api/patient/appointments/create-order   → create a Razorpay order for a booking (no Appointment yet)
// POST  /api/patient/appointments                → verify payment + book (body includes razorpay_* fields)
// GET   /api/patient/appointments/:id            → single appointment detail
// PATCH /api/patient/appointments/:id/cancel     → cancel (body: { reason })
// PATCH /api/patient/appointments/:id/reschedule → reschedule (body: { date })
const express = require('express');
const {
   getAppointments,
   getAppointmentById,
   createOrder,
   createAppointment,
   cancelAppointment,
   rescheduleAppointment,
} = require('../controllers/patientAppointmentController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

router.get('/', getAppointments);
// Must be registered before '/:id' — Express matches path segments in
// registration order, and 'create-order' would otherwise never be reached
// if a param route for POST existed above it (it doesn't here, but keep
// this ordering if one is ever added).
router.post('/create-order', createOrder);
router.post('/', createAppointment);
router.get('/:id', getAppointmentById);
router.patch('/:id/cancel', cancelAppointment);
router.patch('/:id/reschedule', rescheduleAppointment);

module.exports = router;
