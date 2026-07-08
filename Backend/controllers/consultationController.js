// ─── Consultation Controller ──────────────────────────────────────────────────
// Issues Agora RTC tokens for video/audio appointments.
//
// Mounted twice in server.js — once behind doctorProtect (routes/consultationRoutes.js)
// and once behind patientProtect (routes/patientConsultationRoutes.js) — both point
// at this same handler. The handler figures out from `appointment.doctor` /
// `appointment.patient` which side the requester is on, rather than trusting
// a role claimed by the client.
//
// ASSUMPTIONS — adjust if wrong:
//   - Appointment model path: '../models/Appointment' (matches models/Appointment.js)
//   - agoraToken.js lives at '../services/agoraToken' — move it there if it's
//     currently sitting somewhere else, or fix the require path below.
//   - req.user.id is set by both doctorProtect and patientProtect (confirmed
//     from the files you shared — both attach req.user = { id, ... }).

const Appointment = require('../models/Appointment');
const { generateAgoraToken } = require('../services/agoraToken');

// Agora numeric uid must be a 32-bit unsigned int, but Mongo ObjectIds are
// 24 hex chars. Derive a stable numeric uid from the last 8 hex chars of the
// requester's Mongo id — deterministic, so the same person always gets the
// same uid for a given appointment (useful for reconnects).
function toNumericUid(mongoId) {
   const hex = mongoId.toString().slice(-8);
   return parseInt(hex, 16) % 1000000000; // keep well under uint32 max
}

// POST /api/consultation/token          (doctor-protected route)
// POST /api/patient/consultation/token  (patient-protected route)
// body: { appointmentId }
exports.getConsultationToken = async (req, res) => {
   try {
      const { appointmentId } = req.body;
      if (!appointmentId) {
         return res.status(400).json({ message: 'appointmentId is required' });
      }

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }

      const requesterId = req.user.id.toString();
      const isDoctor = appointment.doctor.toString() === requesterId;
      const isPatient = appointment.patient.toString() === requesterId;

      // Whichever protect middleware ran, the requester must be ONE of the
      // two people on this specific appointment — not just any logged-in
      // doctor/patient. This is what stops user A from joining user B's call.
      if (!isDoctor && !isPatient) {
         return res.status(403).json({ message: 'You are not part of this appointment' });
      }

      if (appointment.status !== 'upcoming') {
         return res.status(400).json({ message: 'This appointment is not currently active' });
      }

      if (appointment.type === 'Chat') {
         return res.status(400).json({ message: 'This appointment is a chat consultation — use the chat token flow instead' });
      }

      // Deterministic channel name derived from the appointment id itself —
      // both doctor and patient independently compute the same channel name,
      // so no extra field is needed on the Appointment schema.
      const channelName = `apt_${appointment._id}`;
      const uid = toNumericUid(requesterId);

      const tokenData = generateAgoraToken(channelName, uid, 'publisher');

      res.json({
         ...tokenData,
         isDoctor,
         appointmentType: appointment.type, // 'Video' | 'Audio'
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to generate consultation token', error: err.message });
   }
};
