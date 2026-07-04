// ─── Appointment Routes (Patient-facing) ──────────────────────────────────────
// All routes require a valid PATIENT JWT (patientProtect middleware).
// Scoped to the logged-in patient only — every query filters by req.user.id.
//
// GET   /api/patient/appointments               → list patient's appointments
// POST  /api/patient/appointments                → book a new appointment
// GET   /api/patient/appointments/:id            → single appointment detail
// PATCH /api/patient/appointments/:id/cancel     → cancel (body: { reason })
// PATCH /api/patient/appointments/:id/reschedule → reschedule (body: { date })
const express = require('express');
const {
   getAppointments,
   getAppointmentById,
   createAppointment,
   cancelAppointment,
   rescheduleAppointment,
} = require('../controllers/patientAppointmentController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

router.get('/', getAppointments);
router.post('/', createAppointment);
router.get('/:id', getAppointmentById);
router.patch('/:id/cancel', cancelAppointment);
router.patch('/:id/reschedule', rescheduleAppointment);

module.exports = router;
