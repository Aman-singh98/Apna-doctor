const express = require('express');
const router = express.Router();

const patientProtect = require('../../middleware/patientProtect');
const { getMedicalHistory, updateMedicalHistory } = require('../../controllers/medicalHistoryController');

// All routes below require a valid patient JWT
router.use(patientProtect);

// GET /api/patient/medical-history
// PUT /api/patient/medical-history
router.route('/')
   .get(getMedicalHistory)
   .put(updateMedicalHistory);

module.exports = router;