// ─── Consultation Routes (Patient-facing) ─────────────────────────────────────
// POST /api/patient/consultation/token   body: { appointmentId }  → { token, appId, channelName, uid, expiresAt, isDoctor, appointmentType }

const express = require('express');
const { getConsultationToken } = require('../controllers/consultationController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

router.post('/token', getConsultationToken);

module.exports = router;
