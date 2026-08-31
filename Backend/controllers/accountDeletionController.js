// controllers/accountDeletionController.js
//
// Handles "Delete Account Permanently" (Settings > Danger Zone) for both
// patients and doctors. Pattern matches Practo/Apollo-24|7-style apps:
//
//   1. requestDeletion  — soft delete. Marks the account pending_deletion,
//      cancels/blocks-out upcoming appointments, schedules a hard purge
//      N days out. User stays logged in during this window.
//   2. cancelDeletion   — undo, as long as we're still inside the grace period.
//   3. finalize (see jobs/accountDeletionJob.js) — a daily sweep that
//      anonymizes PII once the grace period has passed.
//
// We never delete the Patient/Doctor document itself: Appointment,
// Prescription, and Transaction records hold a ref to it, and medical /
// financial records generally must be retained for a minimum period
// regardless of the user's delete request. We anonymize the identity
// instead of removing the row.

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');

const GRACE_PERIOD_DAYS = 15; // matches the existing "processed within 15 days" copy

// ── Patient ──────────────────────────────────────────────────────────────────

exports.requestPatientDeletion = async (req, res, next) => {
   try {
      const patient = await Patient.findById(req.user.id);
      if (!patient) {
         return res.status(404).json({ success: false, message: 'Patient not found.' });
      }
      if (patient.accountStatus === 'deleted') {
         return res.status(410).json({ success: false, message: 'This account has already been deleted.' });
      }
      if (patient.accountStatus === 'pending_deletion') {
         return res.status(200).json({
            success: true,
            alreadyRequested: true,
            message: `Deletion is already scheduled for ${patient.deletionScheduledAt.toDateString()}.`,
            scheduledFor: patient.deletionScheduledAt,
         });
      }

      const now = new Date();
      const scheduledFor = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      patient.accountStatus = 'pending_deletion';
      patient.deletionRequestedAt = now;
      patient.deletionScheduledAt = scheduledFor;
      await patient.save();

      // Don't leave doctors hanging on a patient who's on their way out.
      await Appointment.updateMany(
         { patient: patient._id, status: 'upcoming' },
         { $set: { status: 'cancelled', cancelReason: 'Patient requested account deletion' } }
      );

      return res.status(200).json({
         success: true,
         message: `Your account will be permanently deleted on ${scheduledFor.toDateString()}. You can cancel this anytime before then from Settings.`,
         scheduledFor,
      });
   } catch (err) {
      next(err);
   }
};

exports.cancelPatientDeletion = async (req, res, next) => {
   try {
      const patient = await Patient.findById(req.user.id);
      if (!patient) {
         return res.status(404).json({ success: false, message: 'Patient not found.' });
      }
      if (patient.accountStatus !== 'pending_deletion') {
         return res.status(400).json({ success: false, message: 'No pending deletion request found.' });
      }

      patient.accountStatus = 'active';
      patient.deletionRequestedAt = undefined;
      patient.deletionScheduledAt = undefined;
      await patient.save();

      return res.status(200).json({ success: true, message: 'Account deletion cancelled. Welcome back!' });
   } catch (err) {
      next(err);
   }
};

// ── Doctor ───────────────────────────────────────────────────────────────────
//
// Uses req.doctorId (set by middleware/auth.js) rather than req.user.id from
// doctorProtect — deliberately, since doctorProtect blocks anyone who isn't
// 'approved', and a pending/rejected/suspended doctor still needs to be able
// to delete their own account. Mount these routes behind `auth`, not
// `doctorProtect` (see routes/accountDeletionRoutes.js).

exports.requestDoctorDeletion = async (req, res, next) => {
   try {
      const doctor = await Doctor.findById(req.doctorId);
      if (!doctor) {
         return res.status(404).json({ success: false, message: 'Doctor not found.' });
      }
      if (doctor.accountStatus === 'deleted') {
         return res.status(410).json({ success: false, message: 'This account has already been deleted.' });
      }
      if (doctor.accountStatus === 'pending_deletion') {
         return res.status(200).json({
            success: true,
            alreadyRequested: true,
            message: `Deletion is already scheduled for ${doctor.deletionScheduledAt.toDateString()}.`,
            scheduledFor: doctor.deletionScheduledAt,
         });
      }

      // Don't allow deletion while a patient is mid-consultation with them —
      // avoids stranding a patient and sidesteps payout disputes on
      // unresolved appointments. Doctor must complete/cancel first.
      const activeAppointments = await Appointment.countDocuments({
         doctor: doctor._id,
         status: 'upcoming',
      });
      if (activeAppointments > 0) {
         return res.status(409).json({
            success: false,
            message: `You have ${activeAppointments} upcoming appointment(s). Please complete or cancel them before deleting your account.`,
         });
      }

      const now = new Date();
      const scheduledFor = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      doctor.accountStatus = 'pending_deletion';
      doctor.deletionRequestedAt = now;
      doctor.deletionScheduledAt = scheduledFor;
      doctor.available = false; // pull off the "book a doctor" list immediately
      await doctor.save();

      return res.status(200).json({
         success: true,
         message: `Your account will be permanently deleted on ${scheduledFor.toDateString()}. You can cancel this anytime before then from Settings.`,
         scheduledFor,
      });
   } catch (err) {
      next(err);
   }
};

exports.cancelDoctorDeletion = async (req, res, next) => {
   try {
      const doctor = await Doctor.findById(req.doctorId);
      if (!doctor) {
         return res.status(404).json({ success: false, message: 'Doctor not found.' });
      }
      if (doctor.accountStatus !== 'pending_deletion') {
         return res.status(400).json({ success: false, message: 'No pending deletion request found.' });
      }

      doctor.accountStatus = 'active';
      doctor.deletionRequestedAt = undefined;
      doctor.deletionScheduledAt = undefined;
      doctor.available = true;
      await doctor.save();

      return res.status(200).json({ success: true, message: 'Account deletion cancelled. Welcome back!' });
   } catch (err) {
      next(err);
   }
};
