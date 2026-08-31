// routes/doctorMe.js

const express = require('express');
const { getStatus, acceptTerms, completeSignup, submitPayoutKyc, getMyPayoutInfo } = require('../controllers/doctorMeController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// All routes here require a valid doctor JWT
router.use(auth);

router.get('/status', getStatus);
router.post('/accept-terms', acceptTerms);

// Phase 3 (tasks 17-19): PAN/bank-or-UPI/business KYC needed to create the
// doctor's Razorpay Route linked account on approval, submitted from
// doctor-signup.js's payout section (task 19). submitPayoutKyc also doubles
// as the update path — Edit Profile posts here again to change any of these
// fields, since Doctor.setPayoutKyc() just overwrites what's already there.
router.get('/payout-kyc', getMyPayoutInfo);
router.post('/payout-kyc', submitPayoutKyc);

// multipart: two named file fields
router.post(
	'/signup',
	upload.fields([
		{ name: 'medicalLicense', maxCount: 1 },
		{ name: 'idProof', maxCount: 1 },
		{ name: 'signature', maxCount: 1 },
	]),
	completeSignup
);

module.exports = router;
