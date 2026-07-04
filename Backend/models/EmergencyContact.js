const mongoose = require('mongoose');
const { Schema } = mongoose;

const emergencyContactSchema = new Schema(
   {
      // The patient account that owns this emergency contact.
      patient: {
         type: Schema.Types.ObjectId,
         ref: 'Patient',
         required: true,
         index: true,
      },

      name: { type: String, trim: true, required: true },

      // Free text on the frontend (e.g. "Spouse, Brother, Friend"),
      // so kept unrestricted rather than an enum.
      relation: { type: String, trim: true, required: true },

      phone: { type: String, trim: true, required: true },
   },
   { timestamps: true }
);

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);
