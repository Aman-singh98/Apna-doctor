const Doctor = require('../models/Doctor');

async function listDoctors(req, res) {
  const status = req.query.status || 'pending';
  const doctors = await Doctor.find({ approvalStatus: status }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, count: doctors.length, doctors });
}

async function approveDoctor(req, res) {
  const doctor = await Doctor.findByIdAndUpdate(
    req.params.doctorId,
    { $set: { approvalStatus: 'approved', approvedAt: new Date(), rejectionReason: '' } },
    { new: true }
  );
  if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
  res.json({ success: true, approvalStatus: doctor.approvalStatus });
}

async function rejectDoctor(req, res) {
  const { reason } = req.body;
  if (!reason?.trim()) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  }
  const doctor = await Doctor.findByIdAndUpdate(
    req.params.doctorId,
    { $set: { approvalStatus: 'rejected', rejectionReason: reason } },
    { new: true }
  );
  if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
  res.json({ success: true, approvalStatus: doctor.approvalStatus });
}

module.exports = { listDoctors, approveDoctor, rejectDoctor };
