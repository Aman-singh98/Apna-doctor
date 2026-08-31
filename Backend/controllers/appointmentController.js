// ─── Appointment Controller (Doctor-facing) ───────────────────────────────────
// Used by routes/appointmentRoutes.js
//
// ASSUMPTIONS — adjust to match your real Mongoose schema:
//   - Model name: 'Appointment'  (change the require path below if different)
//   - Fields assumed on the Appointment document, based on appointments.js screen:
//       doctor       → ObjectId ref to Doctor (the logged-in doctor)
//       patientName  → String
//       age          → Number
//       type         → String enum: 'Video' | 'Audio' | 'Chat'
//       date         → Date or String ('Today' / 'Tomorrow' label is a FRONTEND
//                      concern — backend should store a real Date and let the
//                      frontend compute the "Today"/"Tomorrow" label)
//       time         → String, e.g. '10:00 AM'  (or store as part of a single
//                      Date field — your call)
//       status       → String enum: 'upcoming' | 'completed' | 'cancelled'
//       issue        → String (chief complaint / reason for visit)
//   - req.user.id    → the logged-in doctor's id, set by your `protect` middleware.
//                      If your middleware attaches it differently
//                      (e.g. req.doctor._id), update every line below that
//                      reads req.user.id.

const Appointment = require('../models/Appointment'); // adjust path/name if different
const MedicalHistory = require('../models/MedicalHistory');
const Prescription = require('../models/Prescription');
const Record = require('../models/Record');
const Transaction = require('../models/Transaction');
const razorpayService = require('../services/razorpayService');
const refundService = require('../services/refundService');
const { TRANSACTION_STATUS } = require('../constants/paymentConstants');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');
const { notify } = require('../utils/notify');

// GET /api/appointments?status=upcoming|completed
exports.getAppointments = async (req, res) => {
   try {
      const { status } = req.query;
      const filter = { doctor: req.user.id };
      if (status) filter.status = status;

      const appointments = await Appointment.find(filter).sort({ date: 1 });
      res.json(appointments);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointments', error: err.message });
   }
};

// GET /api/appointments/today
exports.getTodayAppointments = async (req, res) => {
   try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await Appointment.find({
         doctor: req.user.id,
         date: { $gte: startOfDay, $lte: endOfDay },
      }).sort({ date: 1 });

      res.json(appointments);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch today\'s appointments', error: err.message });
   }
};

// GET /api/appointments/:id
exports.getAppointmentById = async (req, res) => {
   try {
      const appointment = await Appointment.findOne({
         _id: req.params.id,
         doctor: req.user.id, // ensures a doctor can't fetch another doctor's appointment
      });

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointment', error: err.message });
   }
};

// PATCH /api/appointments/:id/complete
//
// Phase 5, tasks 27–28: on top of the existing status flip, this now
// releases the doctor's held Route transfer (task 27) and reflects that on
// the Transaction (task 28) — same "money movement must be idempotent"
// standard as every other payment-adjacent endpoint.
//
// The { status: 'upcoming' } filter on the update below is what makes this
// idempotent: a retried/duplicate complete request (double-tap, client
// retry) can never re-run the fund-release logic a second time, because
// the update only succeeds on the very first call. See the fallback branch
// just below for what a second call sees instead.
exports.completeAppointment = async (req, res) => {
   try {
      const appointment = await Appointment.findOneAndUpdate(
         { _id: req.params.id, doctor: req.user.id, status: 'upcoming' },
         { status: 'completed', completedAt: new Date() },
         { new: true }
      );

      if (!appointment) {
         // Either no such appointment for this doctor, or it exists but
         // isn't 'upcoming' anymore (already completed, or cancelled) — the
         // filter above doesn't distinguish those, so look it up separately
         // to return the right response for each case.
         const existing = await Appointment.findOne({ _id: req.params.id, doctor: req.user.id });
         if (!existing) {
            return res.status(404).json({ message: 'Appointment not found' });
         }
         if (existing.status === 'completed') {
            // Already completed — no-op. Fund release already ran (or was
            // attempted) on the call that actually made this transition;
            // never re-run it here.
            return res.json(existing);
         }
         return res.status(400).json({ message: `Cannot complete an appointment with status '${existing.status}'` });
      }

      // ── Task 27: release the held Route transfer, if one exists ──────────
      const transaction = await Transaction.findOne({ appointment: appointment._id });

      if (transaction && transaction.razorpayTransferId && transaction.onHold) {
         try {
            await razorpayService.releaseTransfer(transaction.razorpayTransferId);

            // ── Task 28: pending → credited ─────────────────────────────────
            transaction.onHold = false;
            if (transaction.status === TRANSACTION_STATUS.PENDING) {
               transaction.status = TRANSACTION_STATUS.CREDITED;
            }
            await transaction.save();

            logEvent(
               'consultation.complete.transfer_released',
               { appointmentId: String(appointment._id), transferId: transaction.razorpayTransferId },
               { transactionId: String(transaction._id) }
            );
         } catch (err) {
            // A Razorpay-side failure here must never undo the consultation
            // completion itself — the consult happened regardless of
            // whether the payout call succeeded. Leave the Transaction as
            // still on_hold/pending and log loudly: this is exactly what
            // task 30's "alert on any transfer stuck on_hold past a
            // reasonable SLA" monitoring is meant to catch, with admin
            // manual reconciliation (Phase 9) as the fallback.
            logSecurityEvent(
               'consultation.complete.transfer_release_failed',
               { appointmentId: String(appointment._id), transferId: transaction.razorpayTransferId },
               { transactionId: String(transaction._id), message: err.message }
            );
         }
      } else if (transaction && !transaction.razorpayTransferId) {
         // No Route transfer was ever created for this Transaction (e.g.
         // the doctor had no linked account yet at booking time, per the
         // webhook/app-driven "transfer_skipped_no_linked_account" path) —
         // nothing to release via the API. Flag for admin manual payout
         // rather than silently marking it credited without a real
         // transfer having confirmed it.
         logSecurityEvent(
            'consultation.complete.no_transfer_to_release',
            { appointmentId: String(appointment._id) },
            { transactionId: String(transaction._id) }
         );
      }
      // If there's no Transaction at all (e.g. a legacy pre-payment-
      // integration appointment, see models/Appointment.js's migration
      // note), there's nothing payment-related to do here — same as before.

      await notify({
         recipientId: appointment.patient,
         recipientRole: 'patient',
         type: 'appointment',
         title: 'Consultation Completed',
         desc: `Your ${appointment.type} consultation with Dr. ${req.user.name} has been marked as completed.`,
         meta: { appointmentId: appointment._id },
      });

      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to complete appointment', error: err.message });
   }
};

// GET /api/appointments/:id/history
// Returns the patient's medical history + their full prescription history
// with this doctor, so the "History" button on the appointment detail modal
// can show both in one screen without a separate patient-lookup step.
exports.getPatientHistory = async (req, res) => {
   try {
      // Scope to this doctor's own appointment first — this is what proves
      // the requesting doctor is allowed to see this patient's data at all.
      const appointment = await Appointment.findOne({
         _id: req.params.id,
         doctor: req.user.id,
      });

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }

      const medicalHistory = await MedicalHistory.findOne({ patient: appointment.patient });

      // `Prescription.patient` can be null for prescriptions issued via
      // free-text patient name (see Prescription.js), so also match on
      // name+phone as a fallback to catch those older/manual records.
      const prescriptions = await Prescription.find({
         doctor: req.user.id,
         $or: [
            { patient: appointment.patient },
            { patientName: appointment.patientName, patientPhone: appointment.patientPhone },
         ],
      }).sort({ date: -1 });

      // Records (lab reports / prescriptions uploads / vaccines) are always
      // tied to a real Patient account (patient is required on the schema,
      // no free-text fallback like Prescription has), so this only returns
      // results when appointment.patient is set.
      const records = appointment.patient
         ? await Record.find({ patient: appointment.patient }).sort({ createdAt: -1 })
         : [];

      res.json({
         patientName: appointment.patientName,
         patientPhone: appointment.patientPhone,
         medicalHistory: medicalHistory || null,
         prescriptions,
         records,
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch patient history', error: err.message });
   }
};

// PATCH /api/appointments/:id/cancel
// body: { reason }
//
// Phase 6, task 34: the doctor-side reject/no-show cancellation action —
// this is the one cancel endpoint on the doctor app, covering both "doctor
// declines/cancels before the consult" and "patient no-showed" cases, both
// of which the app sends through here with an appropriate `reason`. Same
// refund path and same atomic-transition idempotency guard as the
// patient-side cancel endpoint (patientAppointmentController.cancelAppointment).
exports.cancelAppointment = async (req, res) => {
   try {
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
         return res.status(400).json({ message: 'Cancellation reason is required' });
      }

      // Atomic status transition — only the request that actually flips
      // 'upcoming' -> 'cancelled' goes on to issue a refund. Previously this
      // endpoint updated regardless of current status, which would have let
      // a retried/duplicate cancel call re-trigger a refund attempt every
      // time; the { status: 'upcoming' } filter closes that.
      const appointment = await Appointment.findOneAndUpdate(
         { _id: req.params.id, doctor: req.user.id, status: 'upcoming' },
         { status: 'cancelled', cancelReason: reason },
         { new: true }
      );

      if (!appointment) {
         const existing = await Appointment.findOne({ _id: req.params.id, doctor: req.user.id });
         if (!existing) {
            return res.status(404).json({ message: 'Appointment not found' });
         }
         if (existing.status === 'cancelled') {
            // Already cancelled — no-op, same as the completed-appointment
            // no-op branch in completeAppointment above. Never re-refund.
            return res.json(existing);
         }
         return res.status(400).json({ message: `Cannot cancel an appointment with status '${existing.status}'` });
      }

      await refundService.refundAppointment({ appointment, reason, initiatedBy: 'doctor' });

      await notify({
         recipientId: appointment.patient,
         recipientRole: 'patient',
         type: 'appointment',
         title: 'Appointment Cancelled',
         desc: `Dr. ${req.user.name} cancelled your ${appointment.type} consultation. Reason: ${reason}`,
         meta: { appointmentId: appointment._id },
      });

      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to cancel appointment', error: err.message });
   }
};
