// ─── Prescription Routes (Doctor-facing) ──────────────────────────────────────
// All routes require a valid DOCTOR JWT (protect middleware).
// Scoped to the logged-in doctor only.
//
// GET    /api/prescriptions          → list doctor's issued prescriptions (filter: ?search=)
// GET    /api/prescriptions/:id      → single prescription detail
// GET    /api/prescriptions/:id/pdf  → download prescription as a PDF slip
// POST   /api/prescriptions          → create + send new prescription
//        body: { patientName, diagnosis, medicines: [{name, dosage, frequency, duration, instructions}], notes, followUp }
// PUT    /api/prescriptions/:id      → update existing prescription (same body shape as POST)
// DELETE /api/prescriptions/:id      → delete a prescription
const express = require('express');
const {
  getPrescriptions,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  deletePrescription,
  downloadPrescriptionPdf,
} = require('../controllers/prescriptionController');
const doctorProtect = require('../middleware/doctorProtect');

const router = express.Router();

router.use(doctorProtect);

router.get('/', getPrescriptions);
router.get('/:id', getPrescriptionById);
router.get('/:id/pdf', downloadPrescriptionPdf);
router.post('/', createPrescription);
router.put('/:id', updatePrescription);
router.delete('/:id', deletePrescription);

module.exports = router;
