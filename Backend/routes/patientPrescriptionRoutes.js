// ─── Prescription Routes (Patient-facing) ─────────────────────────────────────
// All routes require a valid PATIENT JWT (patientProtect middleware).
// Read-only — patients view prescriptions doctors issued to them, never
// create/edit/delete (that stays exclusive to prescriptionRoutes.js).
//
// GET /api/patient/prescriptions      → list my prescriptions (filter: ?search=)
// GET /api/patient/prescriptions/:id  → single prescription detail
//
// Mounted in server.js as:
//     app.use('/api/patient/prescriptions', require('./routes/patientPrescriptionRoutes'));
// (matches the singular /api/patient/... convention used by records, medical
// history, family members, appointments, tickets, and reviews.)

const express = require('express');
const {
   getMyPrescriptions,
   getMyPrescriptionById,
} = require('../controllers/patientPrescriptionController');
const patientProtect = require('../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

router.get('/', getMyPrescriptions);
router.get('/:id', getMyPrescriptionById);

module.exports = router;