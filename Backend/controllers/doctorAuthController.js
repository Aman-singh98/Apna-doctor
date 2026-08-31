const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const { sendOtp, verifyOtp } = require('../services/otpService');

function isValidPhone(phone) {
	return /^[6-9]\d{9}$/.test(phone);
}

async function sendOtpHandler(req, res) {
	const { phone } = req.body;
	if (!phone || !isValidPhone(phone)) {
		return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });
	}
	await sendOtp(phone);
	res.json({ success: true, message: 'OTP sent' });
}

async function verifyOtpHandler(req, res) {
	const { phone, otp } = req.body;
	if (!phone || !otp) {
		return res.status(400).json({ success: false, message: 'phone and otp are required' });
	}
	const valid = await verifyOtp(phone, otp);
	if (!valid) {
		return res.status(400).json({ success: false, message: 'Invalid OTP' });
	}
	let doctor = await Doctor.findOne({ phone });
	if (!doctor) {
		doctor = await Doctor.create({ phone });
	}
	const token = jwt.sign(
		{ doctorId: doctor._id, phone: doctor.phone },
		process.env.JWT_SECRET,
		{ expiresIn: '30d' }
	);
	res.json({
		success: true,
		token,
		doctor: {
			hasAcceptedTerms: doctor.hasAcceptedTerms,
			approvalStatus: doctor.approvalStatus,
		},
	});
}

module.exports = { sendOtpHandler, verifyOtpHandler };
