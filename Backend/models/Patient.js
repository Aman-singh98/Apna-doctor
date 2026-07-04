const mongoose = require('mongoose');
const { Schema } = mongoose;

const patientSchema = new Schema(
   {
      phone: {
         type: String,
         required: true,
         unique: true,
         index: true,
         trim: true,
      },
      name: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      gender: {
         type: String,
         enum: ['Male', 'Female', 'Other'],
      },
      // Kept as a String (e.g. "18-08-1998") to match the DD-MM-YYYY text
      // input on patient-signup.js, rather than parsing it into a Date.
      dob: { type: String, trim: true, default: '' },
      bloodGroup: { type: String, trim: true, default: '' },
      weight: { type: String, trim: true, default: '' },

      // Profile photo, stored on Cloudinary (see services/cloudinaryService.js).
      // publicId is excluded from normal query results (select: false) — it's
      // only needed internally to delete/replace the old image on re-upload.
      photo: {
         url: { type: String, trim: true, default: '' },
         publicId: { type: String, trim: true, default: '', select: false },
      },

      hasAcceptedTerms: { type: Boolean, default: false },
      hasCompletedProfile: { type: Boolean, default: false },

      // Account status, managed by the admin panel (suspend/unsuspend).
      status: {
         type: String,
         enum: ['active', 'suspended'],
         default: 'active',
      },

      // OTP fields — excluded from query results by default (select: false)
      // so they never leak into normal API responses.
      otp: { type: String, select: false },
      otpExpiresAt: { type: Date, select: false },
   },
   { timestamps: true }
);

module.exports = mongoose.model('Patient', patientSchema);
