// ─── Appointment Controller (Doctor-facing) ───────────────────────────────────
// Used by routes/appointmentRoutes.js
//
// ASSUMPTIONS — adjust to match your real Mongoose schema:
//   - Model name: 'Appointment'  (change the require path below if different)
//   - Fields assumed on the Appointment document, based on appointments.js screen:
//       doctor       → ObjectId ref to Doctor (the logged-in doctor)
//       patientName  → String
//       age          → Number
//       type         → String enum: 'Video' | 'Audio' | 'Chat'
//       date         → Date or String ('Today' / 'Tomorrow' label is a FRONTEND
//                      concern — backend should store a real Date and let the
//                      frontend compute the "Today"/"Tomorrow" label)
//       time         → String, e.g. '10:00 AM'  (or store as part of a single
//                      Date field — your call)
//       status       → String enum: 'upcoming' | 'completed' | 'cancelled'
//       issue        → String (chief complaint / reason for visit)
//   - req.user.id    → the logged-in doctor's id, set by your `protect` middleware.
//                      If your middleware attaches it differently
//                      (e.g. req.doctor._id), update every line below that
//                      reads req.user.id.

const Appointment = require('../models/Appointment'); // adjust path/name if different
const MedicalHistory = require('../models/MedicalHistory');
const Prescription = require('../models/Prescription');

// GET /api/appointments?status=upcoming|completed
exports.getAppointments = async (req, res) => {
   try {
      const { status } = req.query;
      const filter = { doctor: req.user.id };
      if (status) filter.status = status;

      const appointments = await Appointment.find(filter).sort({ date: 1 });
      res.json(appointments);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointments', error: err.message });
   }
};

// GET /api/appointments/today
exports.getTodayAppointments = async (req, res) => {
   try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await Appointment.find({
         doctor: req.user.id,
         date: { $gte: startOfDay, $lte: endOfDay },
      }).sort({ date: 1 });

      res.json(appointments);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch today\'s appointments', error: err.message });
   }
};

// GET /api/appointments/:id
exports.getAppointmentById = async (req, res) => {
   try {
      const appointment = await Appointment.findOne({
         _id: req.params.id,
         doctor: req.user.id, // ensures a doctor can't fetch another doctor's appointment
      });

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointment', error: err.message });
   }
};

// PATCH /api/appointments/:id/complete
exports.completeAppointment = async (req, res) => {
   try {
      const appointment = await Appointment.findOneAndUpdate(
         { _id: req.params.id, doctor: req.user.id },
         { status: 'completed' },
         { new: true }
      );

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to complete appointment', error: err.message });
   }
};

// GET /api/appointments/:id/history
// Returns the patient's medical history + their full prescription history
// with this doctor, so the "History" button on the appointment detail modal
// can show both in one screen without a separate patient-lookup step.
exports.getPatientHistory = async (req, res) => {
   try {
      // Scope to this doctor's own appointment first — this is what proves
      // the requesting doctor is allowed to see this patient's data at all.
      const appointment = await Appointment.findOne({
         _id: req.params.id,
         doctor: req.user.id,
      });

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }

      const medicalHistory = await MedicalHistory.findOne({ patient: appointment.patient });

      // `Prescription.patient` can be null for prescriptions issued via
      // free-text patient name (see Prescription.js), so also match on
      // name+phone as a fallback to catch those older/manual records.
      const prescriptions = await Prescription.find({
         doctor: req.user.id,
         $or: [
            { patient: appointment.patient },
            { patientName: appointment.patientName, patientPhone: appointment.patientPhone },
         ],
      }).sort({ date: -1 });

      res.json({
         patientName: appointment.patientName,
         patientPhone: appointment.patientPhone,
         medicalHistory: medicalHistory || null,
         prescriptions,
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch patient history', error: err.message });
   }
};

// PATCH /api/appointments/:id/cancel
// body: { reason }
exports.cancelAppointment = async (req, res) => {
   try {
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
         return res.status(400).json({ message: 'Cancellation reason is required' });
      }

      const appointment = await Appointment.findOneAndUpdate(
         { _id: req.params.id, doctor: req.user.id },
         { status: 'cancelled', cancelReason: reason },
         { new: true }
      );

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to cancel appointment', error: err.message });
   }
};
