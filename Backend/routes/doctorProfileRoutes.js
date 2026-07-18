// ─── Doctor Self-Profile Routes (Doctor-facing) ───────────────────────────────
// All routes require a valid DOCTOR JWT (protect middleware).
// These act on the LOGGED-IN doctor's own record — never another doctor's.
// (This is intentionally separate from the admin doctorRoutes.js, which lets
// an ADMIN view/verify/suspend ANY doctor by :id. This file has no :id params
// at all — it's always "me".)
//
// GET    /api/doctors/me                  → full profile (profile.js)
// PATCH  /api/doctors/me                  → update profile (profile-edit.js)
//        body: { name, qualification, experience, hospital, category, specialization, bio }
//        NOTE: videoFee/audioFee/chatFee are NOT accepted here — they're
//        derived automatically from `category` (see config/doctorFeeConfig.js
//        and the pre('save') hook in models/Doctor.js).
// POST   /api/doctors/me/photo            → upload/replace profile photo (multipart/form-data)
// POST   /api/doctors/me/signature        → upload/replace signature (multipart/form-data)
//        accepts either a gallery-picked image or a drawn signature exported
//        as PNG from the on-screen signature pad — both arrive as a plain
//        file upload, field name "signature"
//
// GET    /api/doctors/me/dashboard        → dashboard stats (dashboard.js)
//        → { todayPatients, monthCount, todayEarnings, rating }
// PATCH  /api/doctors/me/availability     → toggle online/offline (dashboard.js)
//        body: { available: boolean }
// GET    /api/doctors/me/reviews          → recent patient feedback (dashboard.js)
//
// GET    /api/doctors/me/schedule         → availability schedule (schedule.js)
// PUT    /api/doctors/me/schedule         → replace availability schedule (schedule.js)
//        body: { activeDays, activeSlots, videoEnabled, audioEnabled, chatEnabled, maxPatients }
const express = require('express');
const {
  getMyProfile,
  updateMyProfile,
  uploadMyPhoto,
  uploadMySignature,
  getMyDashboard,
  setMyAvailability,
  getMyReviews,
  getMySchedule,
  updateMySchedule,
} = require('../controllers/doctorProfileController');
const doctorProtect = require('../middleware/doctorProtect');
// Multer (or similar) instance for handling the photo upload — adjust path
// to wherever you configure multer in your project.
const upload = require('../middleware/upload');

const router = express.Router();

router.use(doctorProtect);

// ── Profile ────────────────────────────────────────────────────────────────────
router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);
router.post('/me/photo', upload.single('photo'), uploadMyPhoto);
router.post('/me/signature', upload.single('signature'), uploadMySignature);

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get('/me/dashboard', getMyDashboard);
router.patch('/me/availability', setMyAvailability);
router.get('/me/reviews', getMyReviews);

// ── Schedule ───────────────────────────────────────────────────────────────────
router.get('/me/schedule', getMySchedule);
router.put('/me/schedule', updateMySchedule);

module.exports = router;
