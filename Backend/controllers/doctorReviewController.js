// ─── Doctor Review Controller (Doctor-facing) ─────────────────────────────────
// Used by routes/doctorReviewRoutes.js
//
// ASSUMPTION: req.user.id is the logged-in doctor's id, set the same way it
// is in appointmentController.js (via doctorProtect). If your middleware
// attaches it differently, update the req.user.id reference below.

const Review = require('../models/Review');

// GET /api/doctor/reviews/mine
// Returns every review left for the logged-in doctor, newest first, plus
// an aggregate rating/count — used by app/doctor/profile.js (full list +
// the top-of-profile Rating stat) and app/doctor/dashboard.js ("Recent
// patient feedback" + the "My rating" stat card).
exports.getMyReviews = async (req, res) => {
   try {
      const reviews = await Review.find({ doctor: req.user.id })
         .populate('patient', 'name')
         .sort({ createdAt: -1 });

      const count = reviews.length;
      const avgRating = count
         ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
         : 0;

      res.json({ reviews, avgRating, count });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch your reviews', error: err.message });
   }
};
