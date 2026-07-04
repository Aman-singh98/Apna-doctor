const mongoose = require('mongoose');

const medicalHistorySchema = new mongoose.Schema(
   {
      patient: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Patient',
         required: true,
         unique: true, // one medical history document per patient
      },
      conditions: {
         type: [String],
         default: [],
      },
      allergies: {
         type: [String],
         default: [],
      },
      medications: {
         type: [String],
         default: [],
      },
   },
   { timestamps: true }
);

module.exports = mongoose.model('MedicalHistory', medicalHistorySchema);