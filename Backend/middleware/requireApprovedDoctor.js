// middleware/requireApprovedDoctor.js
//
// Use AFTER doctorProtect on any route that should only work for doctors
// whose signup has been reviewed and approved by an admin.
//
// doctorProtect verifies the JWT and sets req.user (or req.doctor — adjust
// the lookup below to match whichever your doctorProtect actually sets).
//
// This middleware then re-fetches the doctor's current approvalStatus and
// blocks the request if it isn't 'approved'. We look it up fresh (rather
// than trusting a status baked into the JWT) so that if an admin suspends
// or rejects a doctor mid-session, access is cut off on the very next
// request instead of waiting for the token to expire.

const Doctor = require('../models/Doctor');

module.exports = async function requireApprovedDoctor(req, res, next) {
   try {
      const doctorId = req.user?.id || req.doctor?.id;

      if (!doctorId) {
         return res.status(401).json({ message: 'Not authorized' });
      }

      const doctor = await Doctor.findById(doctorId).select('approvalStatus');

      if (!doctor) {
         return res.status(401).json({ message: 'Doctor account not found' });
      }

      if (doctor.approvalStatus !== 'approved') {
         return res.status(403).json({
            message:
               doctor.approvalStatus === 'pending'
                  ? 'Your account is still under review. You will get access once an admin approves it.'
                  : doctor.approvalStatus === 'suspended'
                     ? 'Your account has been suspended. Contact support for details.'
                     : doctor.approvalStatus === 'rejected'
                        ? 'Your signup was rejected. Please contact support.'
                        : 'Please complete your signup before accessing this feature.',
            approvalStatus: doctor.approvalStatus,
         });
      }

      next();
   } catch (err) {
      res.status(500).json({ message: 'Failed to verify doctor approval status', error: err.message });
   }
};
