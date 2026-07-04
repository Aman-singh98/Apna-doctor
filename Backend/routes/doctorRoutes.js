// ─── Doctor Routes ────────────────────────────────────────────────────────────
// All routes require a valid admin JWT (protect middleware).
//
// GET    /api/doctors               → list all (with filter + pagination)
// GET    /api/doctors/stats         → status counts for dashboard
// GET    /api/doctors/:id           → single doctor full detail
// PATCH  /api/doctors/:id/verify    → approve doctor
// PATCH  /api/doctors/:id/reject    → reject doctor  (body: { reason })
// PATCH  /api/doctors/:id/suspend   → suspend doctor (body: { reason })
// PATCH  /api/doctors/:id/unsuspend → reactivate suspended doctor
const express = require('express');
const {
  getAllDoctors,
  getDoctorStats,
  getDoctorById,
  verifyDoctor,
  rejectDoctor,
  suspendDoctor,
  unsuspendDoctor,
} = require('../controllers/doctorController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply JWT protection to every route in this file
router.use(protect);

// ── Collection routes ─────────────────────────────────────────────────────────
// NOTE: /stats must be defined BEFORE /:id so Express doesn't treat "stats" as an id
router.get('/',      getAllDoctors);
router.get('/stats', getDoctorStats);

// ── Single resource routes ────────────────────────────────────────────────────
router.get  ('/:id',            getDoctorById);
router.patch('/:id/verify',     verifyDoctor);
router.patch('/:id/reject',     rejectDoctor);
router.patch('/:id/suspend',    suspendDoctor);
router.patch('/:id/unsuspend',  unsuspendDoctor);

module.exports = router;
