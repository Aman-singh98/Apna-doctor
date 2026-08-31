// ─── Review Controller (Patient-facing) ───────────────────────────────────────
// Used by routes/reviewRoutes.js
//
// ASSUMPTIONS — adjust to match your real setup:
//   - req.user.id → the logged-in patient's id, set by your patient JWT
//     middleware (assumed to be middleware/patientProtect.js, mirroring
//     middleware/doctorProtect.js used on the doctor-facing routes). If your
//     middleware attaches the id differently (e.g. req.patient._id), update
//     every line below that reads req.user.id.

const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const { notify } = require('../utils/notify');

// POST /api/patient/reviews
// body: { appointmentId, rating, comment }
exports.createReview = async (req, res) => {
   try {
      const { appointmentId, rating, comment } = req.body;

      if (!appointmentId) {
         return res.status(400).json({ message: 'appointmentId is required' });
      }
      const numericRating = Number(rating);
      if (!numericRating || numericRating < 1 || numericRating > 5) {
         return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }

      // Only the patient who actually had this appointment, and only once
      // it's completed, can review it. This also covers appointments booked
      // for a family member — `appointment.patient` is still the logged-in
      // patient's own id in that case (see Appointment.familyMember), so no
      // extra check is needed to allow those.
      const appointment = await Appointment.findOne({
         _id: appointmentId,
         patient: req.user.id,
         status: 'completed',
      });

      if (!appointment) {
         return res.status(404).json({ message: 'Completed appointment not found' });
      }

      const existing = await Review.findOne({ appointment: appointmentId });
      if (existing) {
         return res.status(409).json({ message: 'You have already reviewed this appointment' });
      }

      const review = await Review.create({
         doctor: appointment.doctor,
         patient: req.user.id,
         appointment: appointmentId,
         rating: numericRating,
         comment: (comment || '').trim(),
      });

      await notify({
         recipientId: review.doctor,
         recipientRole: 'doctor',
         type: 'rating',
         title: 'New Review Received',
         desc: `You received a ${numericRating}★ review${review.comment ? `: "${review.comment.slice(0, 60)}"` : '.'}`,
         meta: { reviewId: review._id, appointmentId },
      });

      res.status(201).json(review);
   } catch (err) {
      res.status(500).json({ message: 'Failed to create review', error: err.message });
   }
};

// PUT /api/patient/reviews/:id
// body: { rating, comment }
exports.updateReview = async (req, res) => {
   try {
      const { rating, comment } = req.body;

      const review = await Review.findOne({ _id: req.params.id, patient: req.user.id });
      if (!review) {
         return res.status(404).json({ message: 'Review not found' });
      }

      if (rating !== undefined) {
         const numericRating = Number(rating);
         if (!numericRating || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
         }
         review.rating = numericRating;
      }
      if (comment !== undefined) {
         review.comment = comment.trim();
      }

      await review.save();
      res.json(review);
   } catch (err) {
      res.status(500).json({ message: 'Failed to update review', error: err.message });
   }
};

// DELETE /api/patient/reviews/:id
exports.deleteReview = async (req, res) => {
   try {
      const review = await Review.findOneAndDelete({ _id: req.params.id, patient: req.user.id });
      if (!review) {
         return res.status(404).json({ message: 'Review not found' });
      }
      res.json({ message: 'Review deleted' });
   } catch (err) {
      res.status(500).json({ message: 'Failed to delete review', error: err.message });
   }
};

// GET /api/patient/reviews/mine
// Used by appointments.js to know, per completed appointment, whether the
// current patient already reviewed it (and with what rating/comment), so it
// can show "Rated ★4 · Edit" instead of the "Rate & Review" button.
exports.getMyReviews = async (req, res) => {
   try {
      const reviews = await Review.find({ patient: req.user.id }).sort({ createdAt: -1 });
      res.json(reviews);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch your reviews', error: err.message });
   }
};

// GET /api/patient/reviews/doctor/:doctorId
// Used by doctor-detail.js to replace the hardcoded mockReviews with real
// data, plus an aggregate rating/count for the stats grid.
exports.getDoctorReviews = async (req, res) => {
   try {
      const { doctorId } = req.params;

      const reviews = await Review.find({ doctor: doctorId })
         .populate('patient', 'name')
         .sort({ createdAt: -1 });

      const count = reviews.length;
      const avgRating = count
         ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
         : 0;

      res.json({ reviews, avgRating, count });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch doctor reviews', error: err.message });
   }
};
