// ─── Doctor Routes (Patient-facing browse) ────────────────────────────────────
// Requires a valid PATIENT JWT. Only ever returns approved doctors.
// Distinct from routes/doctorRoutes.js, which is admin-only.
//
// GET /api/patient/doctors                     → browse/search approved doctors
// GET /api/patient/doctors/:id                  → single doctor detail
// GET /api/patient/doctors/:id/availability      → open slots for ?date=YYYY-MM-DD
const express = require('express');
const {
   getDoctors,
   getDoctorById,
   getAvailability,
} = require('../../controllers/patientDoctorController');
const patientProtect = require('../../middleware/patientProtect');

const router = express.Router();

router.use(patientProtect);

router.get('/', getDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/availability', getAvailability);

module.exports = router;
