const Doctor = require('../models/Doctor');
const { uploadBuffer } = require('../services/cloudinaryService');
const { notifyAllAdmins } = require('../utils/notify');
const { DOCTOR_CATEGORY_KEYS } = require('../config/doctorFeeConfig');
const { logEvent } = require('../utils/paymentLogger');

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

	const { name, qualification, regNumber, hospital, experience, category, specialization } = req.body;

	// NOTE: 'category' is now required here — it was previously missing from
	// this destructure/validation, which meant it never reached the DB and
	// videoFee/audioFee/chatFee always saved as 0.
	const missing = ['name', 'qualification', 'regNumber', 'category', 'specialization']
		.filter(f => !req.body[f]?.trim());
	if (missing.length) {
		return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
	}

	if (!DOCTOR_CATEGORY_KEYS.includes(category)) {
		return res.status(400).json({
			success: false,
			message: `category must be one of: ${DOCTOR_CATEGORY_KEYS.join(', ')}`,
		});
	}

	const medicalLicenseFile = req.files?.medicalLicense?.[0];
	const idProofFile = req.files?.idProof?.[0];
	const signatureFile = req.files?.signature?.[0];
	if (!medicalLicenseFile || !idProofFile) {
		return res.status(400).json({ success: false, message: 'Both medicalLicense and idProof documents are required' });
	}
	const folder = `apnadoctor/doctors/${doctor._id}`;
	// resource_type: 'auto' — these can be PDF or image (see DOCUMENT_SLOTS
	// on the frontend), and Cloudinary needs 'raw'/'auto' for PDFs; 'image'
	// (the uploadBuffer default) would reject a PDF upload.
	const [licenseUpload, idUpload] = await Promise.all([
		uploadBuffer(medicalLicenseFile.buffer, { folder, public_id: `medicalLicense_${Date.now()}`, resource_type: 'auto' }),
		uploadBuffer(idProofFile.buffer, { folder, public_id: `idProof_${Date.now()}`, resource_type: 'auto' }),
	]);

	// Signature is optional at signup (can also be added later from profile).
	let signatureUpload = null;
	if (signatureFile) {
		signatureUpload = await uploadBuffer(signatureFile.buffer, {
			folder,
			public_id: `signature_${Date.now()}`,
			resource_type: 'auto',
		});
	}

	// ── Assign fields on the fetched document and .save() it (NOT
	// findByIdAndUpdate) — this is required so the pre('save') hook in
	// models/Doctor.js that derives videoFee/audioFee/chatFee from
	// `category` actually runs. findByIdAndUpdate bypasses document
	// middleware by default and would leave fees at 0.
	doctor.name = name;
	doctor.qualification = qualification;
	doctor.regNumber = regNumber;
	doctor.hospital = hospital || '';
	doctor.experience = experience ? Number(experience) : undefined;
	doctor.category = category;
	doctor.specialization = specialization;
	doctor.documents = { medicalLicense: licenseUpload, idProof: idUpload };
	if (signatureUpload) {
		doctor.signatureUrl = signatureUpload.url;
		doctor.signaturePublicId = signatureUpload.publicId;
	}
	doctor.approvalStatus = 'pending';
	doctor.signupCompletedAt = new Date();

	await doctor.save();

	await notifyAllAdmins({
		type: 'system',
		title: 'New Doctor Verification Request',
		desc: `Dr. ${name} (${specialization}) submitted their profile for verification.`,
		meta: { doctorId: doctor._id },
	});

	res.json({ success: true, approvalStatus: 'pending' });
}

// POST /api/doctor/me/payout-kyc
//
// Endpoint for a doctor to submit the PAN/bank-or-UPI/business details
// Razorpay Route account creation needs (Phase 3, tasks 17/18). Called
// from ApnaDoctor-Mob/src/app/doctor-signup.js as a second, independent
// request right after signup submission (task 19) — see that file's
// handleSubmit for why it's kept separate from completeSignup (a payout
// KYC failure must not block the doctor's profile from going to review).
//
// Field-level encryption happens inside Doctor.setPayoutKyc() — this
// controller only validates shape/format and never logs the raw values.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_REGEX = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

async function submitPayoutKyc(req, res) {
	const doctor = await Doctor.findById(req.doctorId);
	if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

	const {
		pan,
		bankAccountNumber,
		confirmBankAccountNumber,
		ifscCode,
		upiId,
		legalBusinessName,
		businessType,
		contactEmail,
	} = req.body || {};

	const errors = [];
	if (!pan || !PAN_REGEX.test(String(pan).toUpperCase().trim())) {
		errors.push('A valid 10-character PAN is required.');
	}
	if (!legalBusinessName || !String(legalBusinessName).trim()) {
		errors.push('legalBusinessName is required.');
	}
	if (!businessType || !['individual', 'proprietorship'].includes(String(businessType).trim())) {
		errors.push("businessType must be one of: 'individual', 'proprietorship'.");
	}
	if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contactEmail).trim())) {
		errors.push('A valid contactEmail is required.');
	}

	const hasBankDetails = bankAccountNumber || ifscCode;
	const hasUpi = Boolean(upiId);
	if (!hasBankDetails && !hasUpi) {
		errors.push('Either a bank account (bankAccountNumber + ifscCode) or a upiId is required.');
	}
	if (hasBankDetails) {
		if (!bankAccountNumber || !/^\d{9,18}$/.test(String(bankAccountNumber).trim())) {
			errors.push('bankAccountNumber must be 9-18 digits.');
		}
		if (bankAccountNumber !== confirmBankAccountNumber) {
			errors.push('bankAccountNumber and confirmBankAccountNumber must match.');
		}
		if (!ifscCode || !IFSC_REGEX.test(String(ifscCode).toUpperCase().trim())) {
			errors.push('A valid IFSC code is required.');
		}
	}
	if (hasUpi && !UPI_REGEX.test(String(upiId).trim())) {
		errors.push('upiId is not a valid UPI VPA (e.g. name@bank).');
	}

	if (errors.length) {
		return res.status(400).json({ success: false, message: 'Invalid payout KYC details.', errors });
	}

	doctor.setPayoutKyc({
		pan,
		bankAccountNumber: hasBankDetails ? bankAccountNumber : undefined,
		ifscCode: hasBankDetails ? ifscCode : undefined,
		upiId: hasUpi ? upiId : undefined,
		legalBusinessName,
		businessType,
		contactEmail,
	});
	await doctor.save();

	// Correlation id only — never the PAN/bank/UPI values themselves.
	logEvent('doctor_payout_kyc.submitted', { doctorId: String(doctor._id) });

	res.json({ success: true, message: 'Payout details submitted. These will be used once your profile is approved.' });
}

// GET /api/doctor/me/payout-kyc
//
// Returns only the masked/non-sensitive payout KYC fields already on file
// (panLast4, bankAccountLast4, upiIdMasked, ifscCode, legalBusinessName,
// businessType, contactEmail) plus payoutStatus, so the Edit Profile screen
// can show a doctor what they've submitted without ever re-exposing the
// encrypted PAN/bank/UPI values or the Razorpay linked-account id. Those
// stay excluded here exactly as they are everywhere else in the codebase —
// see the select:false fields in models/Doctor.js and the comment on
// findByIdWithPayoutKyc, which remains the only place that reads them.
async function getMyPayoutInfo(req, res) {
	const doctor = await Doctor.findById(req.doctorId).select(
		'payoutStatus ' +
		'+payoutKyc.panLast4 +payoutKyc.bankAccountLast4 +payoutKyc.ifscCode ' +
		'+payoutKyc.upiIdMasked +payoutKyc.legalBusinessName +payoutKyc.businessType ' +
		'+payoutKyc.contactEmail +payoutKyc.kycSubmittedAt'
	);
	if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

	const kyc = doctor.payoutKyc || {};
	res.json({
		success: true,
		payoutStatus: doctor.payoutStatus,
		hasSubmittedPayoutKyc: Boolean(kyc.kycSubmittedAt),
		legalBusinessName: kyc.legalBusinessName || null,
		businessType: kyc.businessType || null,
		contactEmail: kyc.contactEmail || null,
		panLast4: kyc.panLast4 || null,
		bankAccountLast4: kyc.bankAccountLast4 || null,
		ifscCode: kyc.ifscCode || null,
		upiIdMasked: kyc.upiIdMasked || null,
		submittedAt: kyc.kycSubmittedAt || null,
	});
}

module.exports = { getStatus, acceptTerms, completeSignup, submitPayoutKyc, getMyPayoutInfo };
