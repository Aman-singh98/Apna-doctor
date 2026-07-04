// routes/doctorMe.js

const express = require('express');
const { getStatus, acceptTerms, completeSignup } = require('../controllers/doctorMeController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// All routes here require a valid doctor JWT
router.use(auth);

router.get('/status', getStatus);
router.post('/accept-terms', acceptTerms);

// multipart: two named file fields
router.post(
	'/signup',
	upload.fields([
		{ name: 'medicalLicense', maxCount: 1 },
		{ name: 'idProof', maxCount: 1 },
	]),
	completeSignup
);

module.exports = router;
