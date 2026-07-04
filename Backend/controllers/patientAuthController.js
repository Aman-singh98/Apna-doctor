const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const { sendOtp, verifyOtp } = require('../services/otpService');

// Strips whitespace and any non-digit characters (spaces, +91, dashes, etc.)
// so the same number always maps to the same DB row, regardless of how
// the frontend formatted it on a given screen.
function normalizePhone(phone) {
   return String(phone || '').trim().replace(/\D/g, '').slice(-10);
}

function signToken(patientId) {
   return jwt.sign({ id: patientId, role: 'patient' }, process.env.JWT_SECRET, {
      expiresIn: '30d',
   });
}

// POST /api/patient/auth/send-otp
// body: { phone }
exports.sendOtp = async (req, res) => {
   try {
      const phone = normalizePhone(req.body.phone);
      if (!phone || phone.length !== 10) {
         return res.status(400).json({ message: 'Phone number is required' });
      }

      await sendOtp(phone);

      res.json({ success: true, message: 'OTP sent' });
   } catch (err) {
      res.status(500).json({ message: 'Failed to send OTP', error: err.message });
   }
};

// POST /api/patient/auth/verify-otp
// body: { phone, otp }
// Returns { token, hasAcceptedTerms, hasCompletedProfile } — the frontend's
// otp.js uses the two flags to decide: terms screen, signup screen, or
// straight to the dashboard.
exports.verifyOtp = async (req, res) => {
   try {
      const phone = normalizePhone(req.body.phone);
      const otp = req.body.otp?.trim();

      if (!phone || !otp) {
         return res.status(400).json({ message: 'Phone and OTP are required' });
      }

      const valid = await verifyOtp(phone, otp);
      if (!valid) {
         return res.status(400).json({ message: 'Invalid OTP' });
      }

      let patient = await Patient.findOne({ phone });
      if (!patient) {
         patient = await Patient.create({ phone });
      }

      const token = signToken(patient._id);

      res.json({
         token,
         hasAcceptedTerms: patient.hasAcceptedTerms,
         hasCompletedProfile: patient.hasCompletedProfile,
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to verify OTP', error: err.message });
   }
};
