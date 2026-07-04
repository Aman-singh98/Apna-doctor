const Patient = require('../models/Patient');

// GET /api/admin/patients?search=&status=&page=&limit=
// → { success, total, page, pages, patients }
async function listPatients(req, res) {
   try {
      const { search = '', status = '', page = 1, limit = 20 } = req.query;

      const filter = {};
      if (status) {
         filter.status = status;
      }
      if (search) {
         const re = new RegExp(search, 'i');
         filter.$or = [{ name: re }, { phone: re }, { email: re }];
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);

      const [patients, total] = await Promise.all([
         Patient.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
         Patient.countDocuments(filter),
      ]);

      res.json({
         success: true,
         total,
         page: pageNum,
         pages: Math.ceil(total / limitNum) || 1,
         patients,
      });
   } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch patients', error: err.message });
   }
}

// GET /api/admin/patients/stats
// → { success, stats: { total, active, suspended, profileComplete } }
async function getPatientStats(req, res) {
   try {
      const [total, active, suspended, profileComplete] = await Promise.all([
         Patient.countDocuments({}),
         Patient.countDocuments({ status: 'active' }),
         Patient.countDocuments({ status: 'suspended' }),
         Patient.countDocuments({ hasCompletedProfile: true }),
      ]);

      res.json({ success: true, stats: { total, active, suspended, profileComplete } });
   } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch patient stats', error: err.message });
   }
}

// GET /api/admin/patients/:id
async function getPatientById(req, res) {
   try {
      const patient = await Patient.findById(req.params.id);
      if (!patient) {
         return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      res.json({ success: true, patient });
   } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch patient', error: err.message });
   }
}

// PATCH /api/admin/patients/:id/suspend
async function suspendPatient(req, res) {
   try {
      const patient = await Patient.findByIdAndUpdate(
         req.params.id,
         { status: 'suspended' },
         { new: true }
      );
      if (!patient) {
         return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      res.json({ success: true, message: 'Patient suspended', patient });
   } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to suspend patient', error: err.message });
   }
}

// PATCH /api/admin/patients/:id/unsuspend
async function unsuspendPatient(req, res) {
   try {
      const patient = await Patient.findByIdAndUpdate(
         req.params.id,
         { status: 'active' },
         { new: true }
      );
      if (!patient) {
         return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      res.json({ success: true, message: 'Patient unsuspended', patient });
   } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to unsuspend patient', error: err.message });
   }
}

module.exports = {
   listPatients,
   getPatientStats,
   getPatientById,
   suspendPatient,
   unsuspendPatient,
};
