// ─── controllers/patientController.js ────────────────────────────────────────
// Used by routes/patientRoutes.js — lets a logged-in DOCTOR list/view the
// patients they've consulted with. This is distinct from patientAuthController
// / patientMeController, which handle a PATIENT's own login and profile.
//
// ASSUMPTIONS — adjust to match your real schema:
//   - There's an existing 'Appointment' model (referenced elsewhere in this
//     codebase, e.g. the comment in the original prescriptionController.js:
//     "req.user.id → logged-in doctor's id (see note in appointmentController.js)")
//     with at least { doctor: ObjectId ref Doctor, patient: ObjectId ref Patient, date }.
//   - There's no direct doctor↔patient link otherwise, so "a doctor's patients"
//     is derived as the distinct set of Patient docs with at least one
//     Appointment against this doctor.
//   - Model name: 'Patient' (models/Patient.js), fields: name, email, gender,
//     dob, bloodGroup, weight.

const mongoose = require('mongoose');
const Appointment = require('../models/Appointment'); // adjust path/name if different
const Patient = require('../models/Patient');

// GET /api/patients?search=name-or-condition
// Adds lastVisit / condition / visits per patient, derived from this
// doctor's Appointment history — these don't exist on the Patient model
// itself, so they're computed here rather than stored redundantly.
exports.getPatients = async (req, res) => {
   try {
      const { search } = req.query;
      const doctorId = req.user.id;

      const patientIds = await Appointment.distinct('patient', { doctor: doctorId });

      if (patientIds.length === 0) {
         return res.json([]);
      }

      const [patients, stats] = await Promise.all([
         Patient.find({ _id: { $in: patientIds } })
            .select('-otp -otpExpiresAt')
            .sort({ name: 1 }),
         // Most recent diagnosis + last visit date + total visit count,
         // one row per patient, scoped to only this doctor's appointments.
         Appointment.aggregate([
            {
               $match: {
                  doctor: new mongoose.Types.ObjectId(doctorId),
                  patient: { $in: patientIds },
               },
            },
            { $sort: { date: -1 } },
            {
               $group: {
                  _id: '$patient',
                  lastVisit: { $first: '$date' },
                  condition: { $first: '$diagnosis' },
                  visits: { $sum: 1 },
               },
            },
         ]),
      ]);

      const statsMap = {};
      stats.forEach(s => { statsMap[s._id.toString()] = s; });

      let result = patients.map(p => {
         const s = statsMap[p._id.toString()] || {};
         return {
            ...p.toObject(),
            lastVisit: s.lastVisit || null,
            condition: s.condition || '',
            visits: s.visits || 0,
         };
      });

      // Condition lives on Appointment, not Patient, so this filter has to
      // run after the merge above rather than as a DB-level regex on Patient.
      if (search) {
         const q = search.toLowerCase();
         result = result.filter(p =>
            p.name?.toLowerCase().includes(q) ||
            p.condition?.toLowerCase().includes(q)
         );
      }

      res.json(result);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch patients', error: err.message });
   }
};

// GET /api/patients/:id
// Includes the doctor's visit history with this patient. 404s if the doctor
// has never had an appointment with this patient, so one doctor can't browse
// another doctor's patient records by guessing IDs.
exports.getPatientById = async (req, res) => {
   try {
      const doctorId = req.user.id;

      const visits = await Appointment.find({ doctor: doctorId, patient: req.params.id }).sort({
         date: -1,
      });

      if (visits.length === 0) {
         return res.status(404).json({ message: 'Patient not found' });
      }

      const patient = await Patient.findById(req.params.id).select('-otp -otpExpiresAt');
      if (!patient) {
         return res.status(404).json({ message: 'Patient not found' });
      }

      res.json({ ...patient.toObject(), visits });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch patient', error: err.message });
   }
};
