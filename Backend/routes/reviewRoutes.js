// ─── Review Routes (Patient-facing) ───────────────────────────────────────────
// All routes require a valid PATIENT JWT.
//
// ASSUMPTION: middleware is at ../middleware/patientProtect, mirroring
// doctorProtect used on the doctor-facing appointment routes. If your patient
// auth middleware lives elsewhere or is named differently, update the
// require() below.
//
// POST   /api/patient/reviews               → create a review for a completed appointment
// GET    /api/patient/reviews/mine          → the logged-in patient's own reviews
// GET    /api/patient/reviews/doctor/:doctorId → a doctor's reviews + aggregate rating
// PUT    /api/patient/reviews/:id           → edit own review
// DELETE /api/patient/reviews/:id           → delete own review

const express = require('express');
const {
   createReview,
   updateReview,
   deleteReview,
   getMyReviews,
   getDoctorReviews,
} = require('../controllers/reviewController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

// ── Fixed-path routes first, so Express doesn't treat them as :id ────────────
router.get('/mine', getMyReviews);
router.get('/doctor/:doctorId', getDoctorReviews);

router.post('/', createReview);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);

module.exports = router;
