// ─── models/Prescription.js ────────────────────────────────────────────────────
// Mongoose model for doctor-issued prescriptions.
// Field shape is derived from prescriptionController.js, prescription-write.js,
// and prescriptions.js (the doctor-facing screens).

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Each entry in the medicines array. The mobile app generates a client-side
// `id` (String, e.g. Date.now().toString()) purely for React state/list keys —
// it's not used as a DB identifier, so it's kept optional and unindexed.
const medicineSchema = new Schema(
   {
      id: { type: String },
      name: { type: String, required: true, trim: true },
      dosage: { type: String, trim: true, default: '' },
      frequency: { type: String, trim: true, default: '' },
      duration: { type: String, trim: true, default: '' },
      instructions: { type: String, trim: true, default: '' },
   },
   { _id: false }
);

const prescriptionSchema = new Schema(
   {
      doctor: {
         type: Schema.Types.ObjectId,
         ref: 'Doctor',
         required: true,
         index: true,
      },
      // Links to the actual Patient doc when issued via the patient picker
      // (prescription-write.js). Optional/nullable because patientName used
      // to be free-text before this — two patients can share a name, so this
      // ID (not the name string) is what actually disambiguates them.
      patient: {
         type: Schema.Types.ObjectId,
         ref: 'Patient',
         default: null,
         index: true,
      },
      patientName: {
         type: String,
         required: true,
         trim: true,
      },
      // Captured alongside patientName at write time for the same reason —
      // lets the prescriptions list/detail show which of two same-named
      // patients this actually was, even without populating `patient`.
      patientPhone: {
         type: String,
         trim: true,
         default: '',
      },
      diagnosis: {
         type: String,
         required: true,
         trim: true,
      },
      medicines: {
         type: [medicineSchema],
         validate: {
            validator: (arr) => Array.isArray(arr) && arr.length > 0,
            message: 'At least one medicine is required',
         },
      },
      notes: {
         type: String,
         trim: true,
         default: '',
      },
      // Kept as a free-text String (e.g. "After 2 weeks" or "10 Jul 2026")
      // rather than a Date, since the app's follow-up field accepts either
      // a relative phrase or a typed date string — see prescription-write.js.
      followUp: {
         type: String,
         trim: true,
         default: '',
      },
      date: {
         type: Date,
         default: Date.now,
      },
   },
   { timestamps: true }
);

// Supports the doctor's prescription list + search screen
// (GET /api/prescriptions?search=...), sorted newest first.
prescriptionSchema.index({ doctor: 1, date: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
