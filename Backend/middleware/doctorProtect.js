// middleware/doctorProtect.js
//
// Guards the full doctor app (appointments, profile, earnings, notifications,
// patients, prescriptions). Unlike middleware/auth.js (used only by doctorMe.js
// for onboarding), this REQUIRES approvalStatus === 'approved' — a pending,
// rejected, or suspended doctor should not reach these routes.
//
// Attaches req.user = { id, name, phone } to match what the existing
// controllers (appointmentController.js, doctorProfileController.js, etc.)
// already expect from req.user.id.

const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');

const doctorProtect = async (req, res, next) => {
   try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return res.status(401).json({ success: false, message: 'No token provided. Access denied.' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const doctor = await Doctor.findById(decoded.doctorId).select('name phone approvalStatus');
      if (!doctor) {
         return res.status(401).json({ success: false, message: 'Doctor account not found.' });
      }

      if (doctor.approvalStatus === 'suspended') {
         return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact support.' });
      }
      if (doctor.approvalStatus !== 'approved') {
         return res.status(403).json({ success: false, message: 'Your profile is not yet approved.' });
      }

      req.user = { id: doctor._id, name: doctor.name, phone: doctor.phone };
      next();
   } catch (err) {
      if (err.name === 'TokenExpiredError') {
         return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
      if (err.name === 'JsonWebTokenError') {
         return res.status(401).json({ success: false, message: 'Invalid token.' });
      }
      next(err);
   }
};

module.exports = doctorProtect;
