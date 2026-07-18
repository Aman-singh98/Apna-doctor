// ─── Doctor Self-Profile Controller (Doctor-facing) ───────────────────────────
// Used by routes/doctorProfileRoutes.js
// Every function here acts on req.user.id ONLY — never another doctor's record.

const Doctor = require('../models/Doctor'); // adjust path/name if different
const Appointment = require('../models/Appointment');
const Transaction = require('../models/Transaction');
const Review = require('../models/Review');
const cloudinaryService = require('../services/cloudinaryService');
const { DOCTOR_CATEGORY_KEYS } = require('../config/doctorFeeConfig');

// GET /api/doctors/me
exports.getMyProfile = async (req, res) => {
   try {
      const doctor = await Doctor.findById(req.user.id).select('-password');
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }
      res.json(doctor);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
   }
};

// PATCH /api/doctors/me
// body: { name, qualification, experience, hospital, category, specialization, bio }
//
// NOTE: videoFee / audioFee / chatFee are intentionally NOT accepted here.
// They're derived automatically from `category` — see the pre('save') hook
// in models/Doctor.js and config/doctorFeeConfig.js. If a body includes
// them, they're silently ignored (not in allowedFields below).
exports.updateMyProfile = async (req, res) => {
   try {
      const allowedFields = [
         'name',
         'qualification',
         'experience',
         'hospital',
         'category',
         'specialization',
         'bio',
      ];

      const updates = {};
      for (const field of allowedFields) {
         if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
         }
      }

      if (Object.keys(updates).length === 0) {
         return res.status(400).json({ message: 'No valid fields provided to update' });
      }

      if (updates.category && !DOCTOR_CATEGORY_KEYS.includes(updates.category)) {
         return res.status(400).json({
            message: `category must be one of: ${DOCTOR_CATEGORY_KEYS.join(', ')}`,
         });
      }

      // Fetch + save (NOT findByIdAndUpdate) — this is required so the
      // pre('save') hook that re-derives videoFee/audioFee/chatFee from
      // category actually runs. findByIdAndUpdate bypasses document
      // middleware by default and would leave stale fee values in place.
      const doctor = await Doctor.findById(req.user.id).select('-password');
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }

      Object.assign(doctor, updates);
      await doctor.save();

      res.json(doctor);
   } catch (err) {
      res.status(500).json({ message: 'Failed to update profile', error: err.message });
   }
};

// ── Store the Cloudinary publicId alongside photoUrl so we can delete the
// old image when a new one is uploaded. Requires adding `photoPublicId`
// to Doctor.js — see note below.

// POST /api/doctors/me/photo  (multipart/form-data, field name: "photo")
exports.uploadMyPhoto = async (req, res) => {
   try {
      if (!req.file) {
         return res.status(400).json({ message: 'No photo file received' });
      }

      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(req.file.mimetype)) {
         return res.status(400).json({ message: 'Only JPEG, PNG, or WebP images are allowed for profile photos' });
      }

      const doctor = await Doctor.findById(req.user.id).select('photoPublicId');
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }

      // Upload new image first — only delete the old one once the new
      // one succeeds, so a failed upload never leaves the doctor with
      // no photo at all.
      const { url, publicId } = await cloudinaryService.uploadBuffer(req.file.buffer, {
         public_id: `doctor_${req.user.id}`,
         overwrite: true,
      });

      const oldPublicId = doctor.photoPublicId;

      const updated = await Doctor.findByIdAndUpdate(
         req.user.id,
         { photoUrl: url, photoPublicId: publicId },
         { new: true }
      ).select('-password');

      if (oldPublicId && oldPublicId !== publicId) {
         await cloudinaryService.deleteByPublicId(oldPublicId);
      }

      res.json(updated);
   } catch (err) {
      res.status(500).json({ message: 'Failed to upload photo', error: err.message });
   }
};

// POST /api/doctors/me/signature  (multipart/form-data, field name: "signature")
//
// Accepts EITHER a gallery-picked image OR a PNG exported from the
// on-screen signature pad (frontend converts the pad's base64 output to a
// file before calling this same endpoint — see utils/imageUtils.js /
// dataUrlToFileUri on the mobile app). Server-side there's no difference
// between the two — both arrive as a regular image file upload.
exports.uploadMySignature = async (req, res) => {
   try {
      if (!req.file) {
         return res.status(400).json({ message: 'No signature file received' });
      }

      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(req.file.mimetype)) {
         return res.status(400).json({ message: 'Only JPEG, PNG, or WebP images are allowed for signatures' });
      }

      const doctor = await Doctor.findById(req.user.id).select('signaturePublicId');
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }

      const { url, publicId } = await cloudinaryService.uploadBuffer(req.file.buffer, {
         public_id: `doctor_signature_${req.user.id}`,
         overwrite: true,
      });

      const oldPublicId = doctor.signaturePublicId;

      const updated = await Doctor.findByIdAndUpdate(
         req.user.id,
         { signatureUrl: url, signaturePublicId: publicId },
         { new: true }
      ).select('-password');

      if (oldPublicId && oldPublicId !== publicId) {
         await cloudinaryService.deleteByPublicId(oldPublicId);
      }

      res.json(updated);
   } catch (err) {
      res.status(500).json({ message: 'Failed to upload signature', error: err.message });
   }
};

// GET /api/doctors/me/dashboard
exports.getMyDashboard = async (req, res) => {
   try {
      const doctorId = req.user.id;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [todayPatients, monthCount, todayEarningsAgg, doctor] = await Promise.all([
         Appointment.countDocuments({ doctor: doctorId, date: { $gte: startOfDay, $lte: endOfDay } }),
         Appointment.countDocuments({ doctor: doctorId, date: { $gte: startOfMonth } }),
         Transaction.aggregate([
            { $match: { doctor: doctorId, status: 'credited', date: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
         ]),
         Doctor.findById(doctorId).select('rating'),
      ]);

      res.json({
         todayPatients,
         monthCount,
         todayEarnings: todayEarningsAgg[0]?.total || 0,
         rating: doctor?.rating || 0,
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch dashboard stats', error: err.message });
   }
};

// PATCH /api/doctors/me/availability
// body: { available: boolean }
exports.setMyAvailability = async (req, res) => {
   try {
      const { available } = req.body;
      if (typeof available !== 'boolean') {
         return res.status(400).json({ message: '"available" must be a boolean' });
      }

      const doctor = await Doctor.findByIdAndUpdate(
         req.user.id,
         { available },
         { new: true }
      ).select('available');

      res.json(doctor);
   } catch (err) {
      res.status(500).json({ message: 'Failed to update availability', error: err.message });
   }
};

// GET /api/doctors/me/reviews
exports.getMyReviews = async (req, res) => {
   try {
      const reviews = await Review.find({ doctor: req.user.id })
         .sort({ createdAt: -1 })
         .limit(10);
      res.json(reviews);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch reviews', error: err.message });
   }
};


// ── Default schedule shown to a doctor who hasn't customized one yet ─────────
// NOT persisted to DB until the doctor actually hits Save.
const DEFAULT_SCHEDULE = {
   activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
   activeSlots: ['09:00 AM', '10:00 AM', '03:00 PM', '04:00 PM'],
   videoEnabled: true,
   audioEnabled: true,
   chatEnabled: true,
   maxPatients: 12,
};

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// GET /api/doctors/me/schedule
exports.getMySchedule = async (req, res) => {
   try {
      const doctor = await Doctor.findById(req.user.id).select('schedule');
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }

      // A doctor who's never saved a schedule has an empty activeDays array
      // (see Doctor.js schema default) — show the default instead of blank.
      const hasCustomSchedule = doctor.schedule?.activeDays?.length > 0;
      const schedule = hasCustomSchedule ? doctor.schedule : DEFAULT_SCHEDULE;

      res.json({ schedule, isDefault: !hasCustomSchedule });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch schedule', error: err.message });
   }
};

// PUT /api/doctors/me/schedule
// body: { activeDays, activeSlots, videoEnabled, audioEnabled, chatEnabled, maxPatients }
exports.updateMySchedule = async (req, res) => {
   try {
      const { activeDays, activeSlots, videoEnabled, audioEnabled, chatEnabled, maxPatients } = req.body;

      // ── Validation ────────────────────────────────────────────────────────
      if (!Array.isArray(activeDays) || activeDays.length === 0) {
         return res.status(400).json({ message: 'Select at least one working day.' });
      }
      if (!activeDays.every((d) => VALID_DAYS.includes(d))) {
         return res.status(400).json({ message: `activeDays must only contain: ${VALID_DAYS.join(', ')}` });
      }
      if (!Array.isArray(activeSlots) || activeSlots.length === 0) {
         return res.status(400).json({ message: 'Select at least one time slot.' });
      }
      if (![videoEnabled, audioEnabled, chatEnabled].some(Boolean)) {
         return res.status(400).json({ message: 'Enable at least one consultation type.' });
      }
      const maxP = Number(maxPatients);
      if (!Number.isInteger(maxP) || maxP < 1) {
         return res.status(400).json({ message: 'maxPatients must be a positive integer.' });
      }

      const doctor = await Doctor.findByIdAndUpdate(
         req.user.id,
         {
            schedule: {
               activeDays,
               activeSlots,
               videoEnabled: !!videoEnabled,
               audioEnabled: !!audioEnabled,
               chatEnabled: !!chatEnabled,
               maxPatients: maxP,
            },
         },
         { new: true, runValidators: true }
      ).select('schedule');

      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found' });
      }

      res.json({ schedule: doctor.schedule, isDefault: false });
   } catch (err) {
      res.status(500).json({ message: 'Failed to update schedule', error: err.message });
   }
};
