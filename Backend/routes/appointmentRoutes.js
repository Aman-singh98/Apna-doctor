// ─── Appointment Routes (Doctor-facing) ───────────────────────────────────────
// All routes require a valid DOCTOR JWT (protect middleware).
// Scoped to the logged-in doctor only — every query filters by req.user.id.
//
// GET    /api/appointments               → list doctor's appointments (filter: ?status=upcoming|completed)
// GET    /api/appointments/today         → today's appointments only (dashboard widget)
// GET    /api/appointments/:id           → single appointment detail
// PATCH  /api/appointments/:id/complete  → mark appointment completed (after consult ends)
// PATCH  /api/appointments/:id/cancel    → cancel appointment (body: { reason })
const express = require('express');
const {
  getAppointments,
  getTodayAppointments,
  getAppointmentById,
  completeAppointment,
  cancelAppointment,
} = require('../controllers/appointmentController');
const doctorProtect = require('../middleware/doctorProtect');
const requireApprovedDoctor = require('../middleware/requireApprovedDoctor');

const router = express.Router();

// Apply JWT protection to every route in this file
router.use(doctorProtect);

// Only approved doctors can access appointments (blocks not_started/pending/rejected/suspended)
router.use(requireApprovedDoctor);

// ── Collection routes ─────────────────────────────────────────────────────────
// NOTE: /today must be defined BEFORE /:id so Express doesn't treat "today" as an id
router.get('/',      getAppointments);
router.get('/today', getTodayAppointments);

// ── Single resource routes ────────────────────────────────────────────────────
router.get  ('/:id',           getAppointmentById);
router.patch('/:id/complete',  completeAppointment);
router.patch('/:id/cancel',    cancelAppointment);

module.exports = router;
