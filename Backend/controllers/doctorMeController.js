const Doctor = require('../models/Doctor');
const { uploadBuffer } = require('../services/cloudinaryService');

async function getStatus(req, res) {
	const doctor = await Doctor.findById(req.doctorId).select('hasAcceptedTerms approvalStatus rejectionReason suspensionReason');
	if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
	res.json({
		success: true,
		hasAcceptedTerms: doctor.hasAcceptedTerms,
		approvalStatus: doctor.approvalStatus,
		rejectionReason: doctor.rejectionReason || null,
		suspensionReason: doctor.suspensionReason || null
	});
}

async function acceptTerms(req, res) {
	await Doctor.findByIdAndUpdate(req.doctorId, {
		$set: { hasAcceptedTerms: true, termsAcceptedAt: new Date() },
	});
	res.json({ success: true });
}

async function completeSignup(req, res) {
	const doctor = await Doctor.findById(req.doctorId);
	if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
	if (!doctor.hasAcceptedTerms) {
		return res.status(400).json({ success: false, message: 'You must accept the Terms & Conditions first' });
	}
	const { name, qualification, regNumber, hospital, experience, specialization } = req.body;
	const missing = ['name', 'qualification', 'regNumber', 'specialization'].filter(f => !req.body[f]?.trim());
	if (missing.length) {
		return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
	}
	const medicalLicenseFile = req.files?.medicalLicense?.[0];
	const idProofFile = req.files?.idProof?.[0];
	console.log(req.files, "req.files");
	// if (!medicalLicenseFile || !idProofFile) {
	// 	return res.status(400).json({ success: false, message: 'Both medicalLicense and idProof documents are required' });
	// }
	// const folder = `apnadoctor/doctors/${doctor._id}`;
	// const [licenseUpload, idUpload] = await Promise.all([
	// 	uploadBuffer(medicalLicenseFile.buffer, folder, `medicalLicense_${Date.now()}`),
	// 	uploadBuffer(idProofFile.buffer, folder, `idProof_${Date.now()}`),
	// ]);
	await Doctor.findByIdAndUpdate(req.doctorId, {
		$set: {
			name, qualification, regNumber,
			hospital: hospital || '',
			experience: experience ? Number(experience) : undefined,
			specialization,
			documents: { medicalLicense: {}, idProof: {} },
			// documents: { medicalLicense: licenseUpload, idProof: idUpload },
			approvalStatus: 'pending',
			signupCompletedAt: new Date(),
		},
	});
	res.json({ success: true, approvalStatus: 'pending' });
}

module.exports = { getStatus, acceptTerms, completeSignup };
