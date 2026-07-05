// ─── Doctor Review Routes (Doctor-facing) ─────────────────────────────────────
// GET /api/doctor/reviews/mine → the logged-in doctor's own reviews + aggregate rating
//
// Protected the same way as routes/appointmentRoutes.js — JWT + approved-doctor
// check — so only an approved, logged-in doctor can see their own reviews.

const express = require('express');
const { getMyReviews } = require('../controllers/doctorReviewController');
const doctorProtect = require('../middleware/doctorProtect');
const requireApprovedDoctor = require('../middleware/requireApprovedDoctor');

const router = express.Router();

router.use(doctorProtect);
router.use(requireApprovedDoctor);

router.get('/mine', getMyReviews);

module.exports = router;
