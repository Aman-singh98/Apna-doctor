const Patient = require('../models/Patient');
const { anonymizePatient } = require('../jobs/accountDeletionJob');

// GET /api/admin/patients?search=&status=&accountStatus=&page=&limit=
// → { success, total, page, pages, patients }
//
// `status` filters the suspend/active flag (Patient.status).
// `accountStatus` filters the self-service deletion lifecycle
// (active | pending_deletion | deleted) — a separate dimension, since a
// patient can be mid-deletion while `status` is still 'active'.
async function listPatients(req, res) {
   try {
      const { search = '', status = '', accountStatus = '', page = 1, limit = 20 } = req.query;

      const filter = {};
      if (status) {
         filter.status = status;
      }
      if (accountStatus) {
         filter.accountStatus = accountStatus;
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
// → { success, stats: { total, active, suspended, profileComplete, pendingDeletion, deleted } }
async function getPatientStats(req, res) {
   try {
      const [total, active, suspended, profileComplete, pendingDeletion, deleted] = await Promise.all([
         Patient.countDocuments({}),
         Patient.countDocuments({ status: 'active' }),
         Patient.countDocuments({ status: 'suspended' }),
         Patient.countDocuments({ hasCompletedProfile: true }),
         Patient.countDocuments({ accountStatus: 'pending_deletion' }),
         Patient.countDocuments({ accountStatus: 'deleted' }),
      ]);

      res.json({
         success: true,
         stats: { total, active, suspended, profileComplete, pendingDeletion, deleted },
      });
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

// PATCH /api/admin/patients/:id/cancel-deletion
// Admin override of the self-service "cancel deletion" — same effect as
// controllers/accountDeletionController.js:cancelPatientDeletion, but
// triggered by an admin (e.g. patient asked support to undo it for them).
async function cancelPatientDeletion(req, res) {
   try {
      const patient = await Patient.findById(req.params.id);
      if (!patient) {
         return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      if (patient.accountStatus !== 'pending_deletion') {
         return res.status(400).json({
            success: false,
            message: 'This patient does not have a scheduled deletion to cancel.',
         });
      }

      patient.accountStatus = 'active';
      patient.deletionRequestedAt = undefined;
      patient.deletionScheduledAt = undefined;
      await patient.save();

      res.json({ success: true, message: 'Scheduled deletion cancelled.', patient });
   } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to cancel deletion', error: err.message });
   }
}

// PATCH /api/admin/patients/:id/finalize-deletion
// Skips the remaining grace period and anonymizes the account immediately.
// Only allowed on accounts already in pending_deletion — this is "finalize
// early", not "delete an active account", so it can't be used to bypass the
// grace period the patient was promised.
async function finalizePatientDeletionNow(req, res) {
   try {
      const patient = await Patient.findById(req.params.id);
      if (!patient) {
         return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      if (patient.accountStatus !== 'pending_deletion') {
         return res.status(400).json({
            success: false,
            message: 'Only accounts with a pending deletion request can be finalized early.',
         });
      }

      await anonymizePatient(patient);

      res.json({ success: true, message: 'Patient account has been permanently deleted.', patient });
   } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to finalize deletion', error: err.message });
   }
}

module.exports = {
   listPatients,
   getPatientStats,
   getPatientById,
   suspendPatient,
   unsuspendPatient,
   cancelPatientDeletion,
   finalizePatientDeletionNow,
};
