// ─── models/Review.js ───────────────────────────────────────────────────────
// A patient's rating + comment for a doctor, always tied to the specific
// completed appointment it was written for. Tying to the appointment (rather
// than just doctor+patient) gives us two things for free:
//   - "only people who actually consulted can review" — enforced in the
//     controller by requiring the appointment to be status: 'completed'
//     and to belong to req.user.id before a review can be created.
//   - "one review per visit" — enforced by the unique index below, so a
//     patient can still leave a separate review for a *different* later
//     appointment with the same doctor, but not two for the same visit.
//
// Reviews are readable/writable by the doctor field for aggregate rating
// display (see reviewController.getDoctorReviews) — average rating/count
// is computed on read rather than stored denormalized on the Doctor doc,
// so there's no second write path to keep in sync.

const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new Schema(
   {
      doctor: {
         type: Schema.Types.ObjectId,
         ref: 'Doctor',
         required: true,
         index: true,
      },
      patient: {
         type: Schema.Types.ObjectId,
         ref: 'Patient',
         required: true,
         index: true,
      },
      // The appointment this review was written for. Also lets a patient
      // review the same doctor again after a later, separate visit.
      appointment: {
         type: Schema.Types.ObjectId,
         ref: 'Appointment',
         required: true,
         unique: true,
      },
      rating: {
         type: Number,
         required: true,
         min: 1,
         max: 5,
      },
      comment: {
         type: String,
         trim: true,
         default: '',
      },
   },
   { timestamps: true }
);

// Supports doctor-detail.js's review list (newest first) and the aggregate
// rating computation, both scoped to a single doctor.
reviewSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
