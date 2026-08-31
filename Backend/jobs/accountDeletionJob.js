// jobs/accountDeletionJob.js
//
// Daily sweep: finds accounts whose grace period has passed and anonymizes
// their PII. We never remove the Patient/Doctor document — Appointment,
// Prescription, and Review records keep a valid ref, satisfying medical/
// financial retention requirements, while the personal data behind it is
// scrubbed.
//
// Start once from server.js:
//   const { startAccountDeletionJob } = require('./jobs/accountDeletionJob');
//   startAccountDeletionJob();
//
// No extra dependency (no node-cron) — a 24h setInterval is enough for a
// once-a-day sweep on a single instance. If you scale to multiple server
// instances, swap this for node-cron/agenda + a lock, or a proper scheduled
// task (e.g. a cron-triggered serverless function), so the sweep doesn't run
// once per instance.

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function finalizePatientDeletions() {
   const due = await Patient.find({
      accountStatus: 'pending_deletion',
      deletionScheduledAt: { $lte: new Date() },
   });

   for (const patient of due) {
      patient.name = 'Deleted User';
      patient.email = '';
      patient.phone = `deleted_${patient._id}`; // keeps the unique index happy, unrecoverable
      patient.dob = '';
      patient.bloodGroup = '';
      patient.weight = '';
      patient.photo = { url: '', publicId: '' };
      patient.otp = undefined;
      patient.otpExpiresAt = undefined;
      patient.accountStatus = 'deleted';
      patient.deletedAt = new Date();
      await patient.save();
   }

   if (due.length) {
      console.log(`[AccountDeletionJob] Finalized ${due.length} patient deletion(s).`);
   }
   return due.length;
}

async function finalizeDoctorDeletions() {
   const due = await Doctor.find({
      accountStatus: 'pending_deletion',
      deletionScheduledAt: { $lte: new Date() },
   });

   for (const doctor of due) {
      doctor.name = 'Deleted Doctor';
      doctor.phone = `deleted_${doctor._id}`;
      doctor.bio = '';
      doctor.photoUrl = '';
      doctor.photoPublicId = '';
      doctor.fcmToken = undefined;
      // Deliberately NOT scrubbing qualification/regNumber/documents — that's
      // the regulatory record of who was licensed to treat patients on the
      // platform, not personal contact info. Drop this comment + those fields
      // too if your compliance stance requires full erasure instead.
      doctor.available = false;
      doctor.accountStatus = 'deleted';
      doctor.deletedAt = new Date();
      await doctor.save();
   }

   if (due.length) {
      console.log(`[AccountDeletionJob] Finalized ${due.length} doctor deletion(s).`);
   }
   return due.length;
}

async function runSweep() {
   try {
      await finalizePatientDeletions();
      await finalizeDoctorDeletions();
   } catch (err) {
      console.error('[AccountDeletionJob] Sweep failed:', err);
   }
}

function startAccountDeletionJob() {
   runSweep(); // also run once at boot, so nothing waits a full day after a deploy
   setInterval(runSweep, ONE_DAY_MS);
}

module.exports = { startAccountDeletionJob, runSweep };
