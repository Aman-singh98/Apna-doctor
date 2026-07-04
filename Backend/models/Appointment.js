// models/Appointment.js
//
// Minimal schema — created to unblock doctorProfileController.js, which
// requires this model for dashboard stats (todayPatients, monthCount).
// Expand as you build out appointmentRoutes.js / appointmentController.js
// (today's list, complete/cancel actions, etc).

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
   {
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
      patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },

      // Set only when booked for a family member rather than the patient themselves
      familyMember: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },

      patientName: { type: String, required: true },
      patientPhone: { type: String },

      fee: { type: Number, default: 0 }, // total fee charged at booking time

      date: { type: Date, required: true, index: true }, // consultation date/time
      type: { type: String, enum: ['Video', 'Audio', 'Chat'], required: true },

      status: {
         type: String,
         enum: ['upcoming', 'completed', 'cancelled'],
         default: 'upcoming',
         index: true,
      },

      diagnosis: { type: String },
      cancelReason: { type: String }, // set when status = 'cancelled'
   },
   { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
