// controllers/medicalHistoryController.js
const MedicalHistory = require('../models/MedicalHistory');

function serialize(doc) {
   return {
      conditions: doc?.conditions || [],
      allergies: doc?.allergies || [],
      medications: doc?.medications || [],
      updatedAt: doc?.updatedAt || null,
   };
}

// Trims whitespace and drops empty/duplicate entries — same rule the
// frontend already applies before adding a tag, enforced again server-side.
function cleanList(list) {
   if (!Array.isArray(list)) return [];
   const seen = new Set();
   const result = [];
   for (const raw of list) {
      const item = String(raw || '').trim();
      if (!item || seen.has(item)) continue;
      seen.add(item);
      result.push(item);
   }
   return result;
}

// GET /api/patient/medical-history
async function getMedicalHistory(req, res, next) {
   try {
      const history = await MedicalHistory.findOne({ patient: req.user.id });
      // No record yet is a normal state (new patient) — return empty lists,
      // not a 404, so the screen can render right away.
      return res.status(200).json({ success: true, data: serialize(history) });
   } catch (err) {
      next(err);
   }
}

// PUT /api/patient/medical-history
// body: { conditions: string[], allergies: string[], medications: string[] }
// Replaces the whole document — matches the screen's single "Save History" action.
async function updateMedicalHistory(req, res, next) {
   try {
      const update = {
         conditions: cleanList(req.body.conditions),
         allergies: cleanList(req.body.allergies),
         medications: cleanList(req.body.medications),
      };

      const history = await MedicalHistory.findOneAndUpdate(
         { patient: req.user.id },
         { $set: update },
         { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ success: true, data: serialize(history) });
   } catch (err) {
      next(err);
   }
}

module.exports = { getMedicalHistory, updateMedicalHistory };
