// ─── Appointment Controller (Patient-facing) ──────────────────────────────────
// Used by routes/patient/appointments.js
//
// Distinct from controllers/appointmentController.js (doctor-facing). This one
// scopes every query by `patient: req.user.id` instead of `doctor`, and
// populates the doctor's name/specialization since that's what the patient
// app needs to display (see app/patient/appointments.js).
//
// ASSUMPTIONS — adjust if wrong:
//   - patientProtect sets req.user.id to the logged-in Patient's _id
//     (same convention as doctorProtect / req.user.id used elsewhere).
//   - Appointment.patient is populated from the booking flow (book-appointment.js
//     backend) — make sure that write path sets `patient: req.user.id` too.

const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const FamilyMember = require('../models/FamilyMember');

const DOCTOR_FIELDS = 'name specialization photoUrl';

// POST /api/patient/appointments
// body: { doctorId, date (ISO string), type: 'Video'|'Audio'|'Chat', familyMemberId?, fee? }
//
// If familyMemberId is omitted, the appointment is booked for the patient themselves.
exports.createAppointment = async (req, res) => {
   try {
      const { doctorId, date, type, familyMemberId, fee, patientName: bodyPatientName } = req.body;

      if (!doctorId || !date || !type) {
         return res.status(400).json({ message: 'doctorId, date, and type are required' });
      }
      if (!['Video', 'Audio', 'Chat'].includes(type)) {
         return res.status(400).json({ message: "type must be 'Video', 'Audio', or 'Chat'" });
      }
      const apptDate = new Date(date);
      if (isNaN(apptDate.getTime())) {
         return res.status(400).json({ message: 'A valid date is required' });
      }

      const doctor = await Doctor.findOne({ _id: doctorId, approvalStatus: 'approved' });
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found or not currently accepting bookings' });
      }

      // Figure out who the appointment is for — the patient, or a family member.
      // req.user.name isn't guaranteed to be populated by patientProtect (it may
      // only carry req.user.id), so fall back to the patientName the frontend
      // already sent for the "self" case. For family members we deliberately
      // ignore the client-sent name and use the authoritative FamilyMember.name
      // instead, so a client can't spoof a different name for that case.
      let patientName = req.user.name || bodyPatientName;
      let familyMember = null;
      if (familyMemberId) {
         familyMember = await FamilyMember.findOne({ _id: familyMemberId, patient: req.user.id });
         if (!familyMember) {
            return res.status(404).json({ message: 'Family member not found' });
         }
         patientName = familyMember.name;
      }

      // Prevent double-booking the same doctor slot.
      const clash = await Appointment.findOne({
         doctor: doctor._id,
         date: apptDate,
         status: 'upcoming',
      });
      if (clash) {
         return res.status(409).json({ message: 'This slot was just booked by someone else. Please pick another.' });
      }

      const appointment = await Appointment.create({
         doctor: doctor._id,
         patient: req.user.id,
         familyMember: familyMember ? familyMember._id : null,
         patientName,
         patientPhone: req.user.phone, // ASSUMPTION: req.user carries phone; adjust if not.
         date: apptDate,
         type,
         status: 'upcoming',
         fee: typeof fee === 'number' ? fee : (type === 'Video' ? doctor.videoFee : type === 'Chat' ? doctor.chatFee : doctor.videoFee),
      });

      res.status(201).json(await appointment.populate('doctor', DOCTOR_FIELDS));
   } catch (err) {
      res.status(500).json({ message: 'Failed to book appointment', error: err.message });
   }
};

// GET /api/patient/appointments
// Returns ALL of the patient's appointments (upcoming, completed, cancelled).
// The app buckets them into "Upcoming" vs "Past" tabs on the frontend, since
// "past" there means completed OR cancelled.
exports.getAppointments = async (req, res) => {
   try {
      const appointments = await Appointment.find({ patient: req.user.id })
         .populate('doctor', DOCTOR_FIELDS)
         .sort({ date: -1 });

      res.json(appointments);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointments', error: err.message });
   }
};

// GET /api/patient/appointments/:id
exports.getAppointmentById = async (req, res) => {
   try {
      const appointment = await Appointment.findOne({
         _id: req.params.id,
         patient: req.user.id, // ensures a patient can't fetch someone else's appointment
      }).populate('doctor', DOCTOR_FIELDS);

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointment', error: err.message });
   }
};

// PATCH /api/patient/appointments/:id/cancel
// body: { reason }
exports.cancelAppointment = async (req, res) => {
   try {
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
         return res.status(400).json({ message: 'Cancellation reason is required' });
      }

      const appointment = await Appointment.findOne({ _id: req.params.id, patient: req.user.id });
      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      if (appointment.status !== 'upcoming') {
         return res.status(400).json({ message: 'Only upcoming appointments can be cancelled' });
      }

      appointment.status = 'cancelled';
      appointment.cancelReason = reason;
      await appointment.save();

      res.json(await appointment.populate('doctor', DOCTOR_FIELDS));
   } catch (err) {
      res.status(500).json({ message: 'Failed to cancel appointment', error: err.message });
   }
};

// PATCH /api/patient/appointments/:id/reschedule
// body: { date }  — ISO datetime string for the new slot
exports.rescheduleAppointment = async (req, res) => {
   try {
      const { date } = req.body;
      if (!date || isNaN(new Date(date).getTime())) {
         return res.status(400).json({ message: 'A valid new date is required' });
      }

      const appointment = await Appointment.findOne({ _id: req.params.id, patient: req.user.id });
      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      if (appointment.status !== 'upcoming') {
         return res.status(400).json({ message: 'Only upcoming appointments can be rescheduled' });
      }

      appointment.date = new Date(date);
      await appointment.save();

      res.json(await appointment.populate('doctor', DOCTOR_FIELDS));
   } catch (err) {
      res.status(500).json({ message: 'Failed to reschedule appointment', error: err.message });
   }
};
