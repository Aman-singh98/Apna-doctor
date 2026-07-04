// models/Review.js
//
// Minimal schema — created to unblock doctorProfileController.js's
// getMyReviews. Matches the shape used by dashboard.js's mock review data
// (patient name, star rating, comment).

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
   {
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
      appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

      patientName: { type: String, required: true },
      rating: { type: Number, min: 1, max: 5, required: true },
      comment: { type: String },
   },
   { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
