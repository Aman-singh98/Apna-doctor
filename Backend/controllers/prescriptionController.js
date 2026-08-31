// ─── Prescription Controller (Doctor-facing) ──────────────────────────────────
// Used by routes/prescriptionRoutes.js
//
// ASSUMPTIONS — adjust to match your real Mongoose schema:
//   - Model name: 'Prescription'
//   - Fields assumed, based on prescription-write.js / prescriptions.js screens:
//       doctor       → ObjectId ref to Doctor (the logged-in doctor)
//       patient      → ObjectId ref to Patient, nullable (set from body.patientId
//                       when the doctor selects via the patient picker)
//       patientName  → String
//       patientPhone → String, optional (disambiguates same-named patients)
//       diagnosis    → String
//       medicines    → Array of { name, dosage, frequency, duration, instructions }
//       notes        → String (optional)
//       followUp     → String (optional, e.g. "After 2 weeks" or a date string)
//       date         → Date, defaults to now
//   - req.user.id    → logged-in doctor's id (see note in appointmentController.js)

const Prescription = require('../models/Prescription'); // adjust path/name if different
const Patient = require('../models/Patient');
const { notify } = require('../utils/notify');
const { streamPrescriptionPdf } = require('../services/prescriptionPdfService');

// Fields actually needed to render the PDF header/signature — see
// services/prescriptionPdfService.js. Doctor has no `email` field, don't
// request one (other controllers in this codebase mistakenly do).
const DOCTOR_PDF_FIELDS = 'name qualification regNumber hospital specialization signatureUrl phone';

// Safety net so a prescription never silently ends up unreachable by the
// patient (patient: null AND patientPhone: '') just because some screen's
// navigation forgot to pass patientId along — e.g. a "Write Rx" shortcut
// added later that only threads patientName through. If the request didn't
// include a patientId but did include a phone number, look up the matching
// Patient account and link it automatically. Best-effort: any lookup error
// or "not found" just leaves `patient` unset, exactly as before.
async function resolvePatientId(patientId, patientPhone) {
   if (patientId) return patientId;
   if (!patientPhone) return null;
   try {
      const match = await Patient.findOne({ phone: patientPhone }).select('_id');
      return match ? match._id : null;
   } catch {
      return null;
   }
}

// GET /api/prescriptions?search=name-or-diagnosis
exports.getPrescriptions = async (req, res) => {
   try {
      const { search } = req.query;
      const filter = { doctor: req.user.id };

      if (search) {
         filter.$or = [
            { patientName: { $regex: search, $options: 'i' } },
            { diagnosis:   { $regex: search, $options: 'i' } },
         ];
      }

      const prescriptions = await Prescription.find(filter).sort({ date: -1 });
      res.json(prescriptions);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch prescriptions', error: err.message });
   }
};

// GET /api/prescriptions/:id
exports.getPrescriptionById = async (req, res) => {
   try {
      const prescription = await Prescription.findOne({
         _id: req.params.id,
         doctor: req.user.id,
      });

      if (!prescription) {
         return res.status(404).json({ message: 'Prescription not found' });
      }
      res.json(prescription);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch prescription', error: err.message });
   }
};

// POST /api/prescriptions
// body: { patientId, patientName, patientPhone, diagnosis, chiefComplaints,
//         allergies, medicalHistory, vitals: {bp,pulse,spo2,temp,rr,weight},
//         medicines, notes, followUp }
//
// patientId/patientPhone come from the patient picker in prescription-write.js
// (see handleSelectPatient()) and exist specifically so two patients sharing
// the same name can't be confused for one another — patientId links straight
// to the real Patient doc, and patientPhone is kept as a fallback for any
// prescription written before that doc was linked. Previously these two
// fields were sent by the app but never read here, so every prescription
// saved with `patient: null` and `patientPhone: ''` regardless of which
// patient the doctor actually selected.
exports.createPrescription = async (req, res) => {
   try {
      const {
         patientId, patientName, patientPhone, diagnosis, medicines, notes, followUp,
         chiefComplaints, allergies, medicalHistory, dietRestrictions, vitals,
      } = req.body;

      if (!patientName?.trim() || !diagnosis?.trim()) {
         return res.status(400).json({ message: 'Patient name and diagnosis are required' });
      }
      if (!Array.isArray(medicines) || medicines.length === 0 || medicines.some(m => !m.name?.trim())) {
         return res.status(400).json({ message: 'At least one medicine with a name is required' });
      }

      const prescription = await Prescription.create({
         doctor: req.user.id,
         // Guard against '' / undefined being cast as an ObjectId — only
         // set `patient` when a real id was actually selected via the picker
         // (or resolvable from the phone number as a fallback — see
         // resolvePatientId above).
         patient: await resolvePatientId(patientId, patientPhone),
         patientName,
         patientPhone: patientPhone || '',
         diagnosis,
         chiefComplaints: chiefComplaints || '',
         allergies: allergies || '',
         medicalHistory: medicalHistory || '',
         dietRestrictions: dietRestrictions || '',
         vitals: vitals || {},
         medicines,
         notes,
         followUp,
         date: new Date(),
      });

      // Only notify when a real Patient account is linked — a free-text
      // patientName with no patientId has nowhere to deliver a notification.
      if (prescription.patient) {
         await notify({
            recipientId: prescription.patient,
            recipientRole: 'patient',
            type: 'prescription',
            title: 'New Prescription Issued',
            desc: `Dr. ${req.user.name} uploaded a new prescription for ${diagnosis}.`,
            meta: { prescriptionId: prescription._id },
         });
      }

      res.status(201).json(prescription);
   } catch (err) {
      res.status(500).json({ message: 'Failed to create prescription', error: err.message });
   }
};

// PUT /api/prescriptions/:id
// body: same shape as POST above
exports.updatePrescription = async (req, res) => {
   try {
      const {
         patientId, patientName, patientPhone, diagnosis, medicines, notes, followUp,
         chiefComplaints, allergies, medicalHistory, dietRestrictions, vitals,
      } = req.body;

      if (!patientName?.trim() || !diagnosis?.trim()) {
         return res.status(400).json({ message: 'Patient name and diagnosis are required' });
      }
      if (!Array.isArray(medicines) || medicines.length === 0 || medicines.some(m => !m.name?.trim())) {
         return res.status(400).json({ message: 'At least one medicine with a name is required' });
      }

      const prescription = await Prescription.findOneAndUpdate(
         { _id: req.params.id, doctor: req.user.id },
         {
            patient: await resolvePatientId(patientId, patientPhone),
            patientName,
            patientPhone: patientPhone || '',
            diagnosis,
            chiefComplaints: chiefComplaints || '',
            allergies: allergies || '',
            medicalHistory: medicalHistory || '',
            dietRestrictions: dietRestrictions || '',
            vitals: vitals || {},
            medicines,
            notes,
            followUp,
         },
         { new: true, runValidators: true }
      );

      if (!prescription) {
         return res.status(404).json({ message: 'Prescription not found' });
      }

      res.json(prescription);
   } catch (err) {
      res.status(500).json({ message: 'Failed to update prescription', error: err.message });
   }
};

// GET /api/prescriptions/:id/pdf
//
// Doctor-side download of the prescription slip — same layout the patient
// gets via patientPrescriptionController.downloadMyPrescriptionPdf, scoped
// to prescriptions this doctor actually wrote.
exports.downloadPrescriptionPdf = async (req, res) => {
   try {
      const prescription = await Prescription.findOne({
         _id: req.params.id,
         doctor: req.user.id,
      }).populate('doctor', DOCTOR_PDF_FIELDS);

      if (!prescription) {
         return res.status(404).json({ message: 'Prescription not found' });
      }

      // Optional enrichment — only present when the Rx was linked to a real
      // Patient account via the patient picker (see models/Prescription.js).
      // Free-text-only prescriptions just render without gender/age/blood
      // group, same as everywhere else in the app.
      const prescriptionObj = prescription.toObject();
      if (prescription.patient) {
         const patientDoc = await Patient.findById(prescription.patient).select('gender dob bloodGroup');
         if (patientDoc) {
            prescriptionObj.patientProfile = patientDoc.toObject();
         }
      }

      await streamPrescriptionPdf(res, prescriptionObj);
   } catch (err) {
      res.status(500).json({ message: 'Failed to generate prescription PDF', error: err.message });
   }
};

// DELETE /api/prescriptions/:id
exports.deletePrescription = async (req, res) => {
   try {
      const prescription = await Prescription.findOneAndDelete({
         _id: req.params.id,
         doctor: req.user.id,
      });

      if (!prescription) {
         return res.status(404).json({ message: 'Prescription not found' });
      }

      res.json({ message: 'Prescription deleted', id: req.params.id });
   } catch (err) {
      res.status(500).json({ message: 'Failed to delete prescription', error: err.message });
   }
};