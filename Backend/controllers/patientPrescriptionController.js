// ─── Prescription Controller (Patient-facing) ─────────────────────────────────
// Used by routes/patientPrescriptionRoutes.js
//
// Read-only mirror of controllers/prescriptionController.js (the doctor
// version). Patients can VIEW prescriptions issued to them — they never
// create, update, or delete one, so only two handlers exist here.
//
// req.user.id → logged-in patient's id (set by middleware/patientProtect.js,
// same property name the doctor middleware uses, just role-checked as
// 'patient' instead of 'doctor').
//
// MATCHING LOGIC — why this isn't just `{ patient: req.user.id }`:
// Prescription.patient is only populated when the doctor issued the Rx via
// the patient picker (see prescription-write.js → handleSelectPatient()).
// Prescriptions written with only free-text patientName (patient: null)
// would be invisible to the real patient otherwise, even though the phone
// number on file matches. So we match on EITHER the linked patient id OR
// the patient's own phone number stored on the Rx at write time.
// Once every prescription in your DB is guaranteed to have `patient` set
// (e.g. once the free-text path is fully retired), this can be simplified
// back down to a single `{ patient: req.user.id }` filter.

const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');

// GET /api/patient/prescriptions?search=diagnosis-or-medicine-name
exports.getMyPrescriptions = async (req, res) => {
   try {
      const patient = await Patient.findById(req.user.id).select('phone');
      if (!patient) {
         return res.status(404).json({ message: 'Patient not found' });
      }

      const identityFilter = {
         $or: [
            { patient: req.user.id },
            ...(patient.phone ? [{ patientPhone: patient.phone }] : []),
         ],
      };

      const { search } = req.query;
      const filter = search
         ? {
              $and: [
                 identityFilter,
                 {
                    $or: [
                       { diagnosis: { $regex: search, $options: 'i' } },
                       { 'medicines.name': { $regex: search, $options: 'i' } },
                    ],
                 },
              ],
           }
         : identityFilter;

      // Populate doctor name so the list can show "Prescribed by Dr. X"
      // without a second round trip. Adjust the select string if your
      // Doctor schema uses different field names (e.g. specialization).
      const prescriptions = await Prescription.find(filter)
         .populate('doctor', 'name')
         .sort({ date: -1 });

      res.json(prescriptions);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch prescriptions', error: err.message });
   }
};

// GET /api/patient/prescriptions/:id
exports.getMyPrescriptionById = async (req, res) => {
   try {
      const patient = await Patient.findById(req.user.id).select('phone');
      if (!patient) {
         return res.status(404).json({ message: 'Patient not found' });
      }

      const prescription = await Prescription.findOne({
         _id: req.params.id,
         $or: [
            { patient: req.user.id },
            ...(patient.phone ? [{ patientPhone: patient.phone }] : []),
         ],
      }).populate('doctor', 'name');

      if (!prescription) {
         return res.status(404).json({ message: 'Prescription not found' });
      }

      res.json(prescription);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch prescription', error: err.message });
   }
};
