// ─── models/Prescription.js ────────────────────────────────────────────────────
// Mongoose model for doctor-issued prescriptions.
// Field shape is derived from prescriptionController.js, prescription-write.js,
// and prescriptions.js (the doctor-facing screens).

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Each entry in the medicines array. The mobile app generates a client-side
// `id` (String, e.g. Date.now().toString()) purely for React state/list keys —
// it's not used as a DB identifier, so it's kept optional and unindexed.
//
// Dosing is captured as a Morning/Afternoon/Evening/Night grid (`morning`,
// `afternoon`, `evening`, `night` — each a free-text count so "1", "1/2",
// "5" (ml) etc. all work, paired with `unit` e.g. Tablet/ml/Drops).
// `dosage` and `frequency` are kept only so prescriptions written before
// this change keep rendering correctly — the write form no longer edits
// them, new prescriptions leave them blank in favor of the M-A-E-N grid.
const medicineSchema = new Schema(
   {
      id: { type: String },
      name: { type: String, required: true, trim: true },
      // Salt composition shown as a second line under the (brand) name on
      // the PDF, e.g. "Levocetirizine 5mg + Montelukast 10mg" under
      // "Aquris Livz M Tablet". Optional/free-text since combination drugs
      // aren't representable as a single row in data/medicines.json.
      composition: { type: String, trim: true, default: '' },
      dosage: { type: String, trim: true, default: '' },
      frequency: { type: String, trim: true, default: '' },
      morning: { type: String, trim: true, default: '' },
      afternoon: { type: String, trim: true, default: '' },
      evening: { type: String, trim: true, default: '' },
      night: { type: String, trim: true, default: '' },
      unit: { type: String, trim: true, default: 'Tablet' },
      duration: { type: String, trim: true, default: '' },
      instructions: { type: String, trim: true, default: '' },
   },
   { _id: false }
);

// Vitals are all free-text (not Number) since they're patient-declared
// during a tele-consultation, not measured — e.g. BP "120/80", Pulse
// "88/min", Temp "99.1°F". Every field is optional; the PDF simply omits
// blank ones rather than showing "—" for a whole vitals row nobody filled.
const vitalsSchema = new Schema(
   {
      bp: { type: String, trim: true, default: '' },
      pulse: { type: String, trim: true, default: '' },
      spo2: { type: String, trim: true, default: '' },
      temp: { type: String, trim: true, default: '' },
      rr: { type: String, trim: true, default: '' },
      weight: { type: String, trim: true, default: '' },
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
      // Free-text, one complaint per line in the mobile form (mirrors how
      // `notes` is already handled) — e.g. "Sore throat — since 2 days".
      chiefComplaints: {
         type: String,
         trim: true,
         default: '',
      },
      allergies: {
         type: String,
         trim: true,
         default: '',
      },
      medicalHistory: {
         type: String,
         trim: true,
         default: '',
      },
      dietRestrictions: {
         type: String,
         trim: true,
         default: '',
      },
      vitals: {
         type: vitalsSchema,
         default: () => ({}),
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
