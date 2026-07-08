// ─── Consultation Routes (Doctor-facing) ──────────────────────────────────────
// POST /api/consultation/token   body: { appointmentId }  → { token, appId, channelName, uid, expiresAt, isDoctor, appointmentType }

const express = require('express');
const { getConsultationToken } = require('../controllers/consultationController');
const doctorProtect = require('../middleware/doctorProtect');
const requireApprovedDoctor = require('../middleware/requireApprovedDoctor');

const router = express.Router();

router.use(doctorProtect);
router.use(requireApprovedDoctor);

router.post('/token', getConsultationToken);

module.exports = router;
