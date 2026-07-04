// ─── Prescription Controller (Doctor-facing) ──────────────────────────────────
// Used by routes/prescriptionRoutes.js
//
// ASSUMPTIONS — adjust to match your real Mongoose schema:
//   - Model name: 'Prescription'
//   - Fields assumed, based on prescription-write.js / prescriptions.js screens:
//       doctor       → ObjectId ref to Doctor (the logged-in doctor)
//       patientName  → String
//       diagnosis    → String
//       medicines    → Array of { name, dosage, frequency, duration, instructions }
//       notes        → String (optional)
//       followUp     → String (optional, e.g. "After 2 weeks" or a date string)
//       date         → Date, defaults to now
//   - req.user.id    → logged-in doctor's id (see note in appointmentController.js)

const Prescription = require('../models/Prescription'); // adjust path/name if different

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
// body: { patientName, diagnosis, medicines, notes, followUp }
exports.createPrescription = async (req, res) => {
   try {
      const { patientName, diagnosis, medicines, notes, followUp } = req.body;

      if (!patientName?.trim() || !diagnosis?.trim()) {
         return res.status(400).json({ message: 'Patient name and diagnosis are required' });
      }
      if (!Array.isArray(medicines) || medicines.length === 0 || medicines.some(m => !m.name?.trim())) {
         return res.status(400).json({ message: 'At least one medicine with a name is required' });
      }

      const prescription = await Prescription.create({
         doctor: req.user.id,
         patientName,
         diagnosis,
         medicines,
         notes,
         followUp,
         date: new Date(),
      });

      res.status(201).json(prescription);
   } catch (err) {
      res.status(500).json({ message: 'Failed to create prescription', error: err.message });
   }
};

// PUT /api/prescriptions/:id
// body: { patientName, diagnosis, medicines, notes, followUp }
exports.updatePrescription = async (req, res) => {
   try {
      const { patientName, diagnosis, medicines, notes, followUp } = req.body;

      if (!patientName?.trim() || !diagnosis?.trim()) {
         return res.status(400).json({ message: 'Patient name and diagnosis are required' });
      }
      if (!Array.isArray(medicines) || medicines.length === 0 || medicines.some(m => !m.name?.trim())) {
         return res.status(400).json({ message: 'At least one medicine with a name is required' });
      }

      const prescription = await Prescription.findOneAndUpdate(
         { _id: req.params.id, doctor: req.user.id },
         { patientName, diagnosis, medicines, notes, followUp },
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
