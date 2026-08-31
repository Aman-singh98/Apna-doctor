// ─── Patient Routes (Doctor-facing) ───────────────────────────────────────────
// All routes require a valid DOCTOR JWT (protect middleware).
// Returns only patients who have consulted with the logged-in doctor.
//
// GET    /api/patients          → list doctor's patients (filter: ?search=name-or-condition)
// GET    /api/patients/:id      → single patient detail (incl. visit history)
const express = require('express');
const {
  getPatients,
  getPatientById,
} = require('../controllers/patientController');
const doctorProtect = require('../middleware/doctorProtect');

const router = express.Router();

router.use(doctorProtect);

router.get('/',     getPatients);
router.get('/:id',  getPatientById);

module.exports = router;
