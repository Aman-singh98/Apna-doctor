const express = require('express');
const { getMe, acceptTerms, signup, uploadPhoto } = require('../../controllers/patientMeController');
const patientProtect = require('../../middleware/patientProtect');
const upload = require('../../middleware/upload');

const router = express.Router();

router.use(patientProtect);

router.get('/', getMe);
router.post('/accept-terms', acceptTerms);
router.post('/signup', signup);
router.post('/photo', upload.single('photo'), uploadPhoto);

module.exports = router;