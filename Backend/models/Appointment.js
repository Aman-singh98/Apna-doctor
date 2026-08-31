// models/Appointment.js
//
// Minimal schema — created to unblock doctorProfileController.js, which
// requires this model for dashboard stats (todayPatients, monthCount).
// Expand as you build out appointmentRoutes.js / appointmentController.js
// (today's list, complete/cancel actions, etc).

const mongoose = require('mongoose');
const { PAYMENT_STATUS_VALUES } = require('../constants/paymentConstants');

const appointmentSchema = new mongoose.Schema(
   {
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
      patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },

      // Set only when booked for a family member rather than the patient themselves
      familyMember: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },

      patientName: { type: String, required: true },
      patientPhone: { type: String },

      fee: { type: Number, default: 0 }, // total fee charged at booking time

      date: { type: Date, required: true, index: true }, // consultation date/time
      type: { type: String, enum: ['Video', 'Audio', 'Chat'], required: true },

      status: {
         type: String,
         enum: ['upcoming', 'completed', 'cancelled'],
         default: 'upcoming',
         index: true,
      },

      // Set only when status flips to 'completed' (see
      // controllers/appointmentController.js completeAppointment). Distinct
      // from `updatedAt`, which any later write (even an unrelated one)
      // would also bump — this is specifically "when did the consult
      // finish," which jobs/transferHoldMonitorJob.js (Phase 5, task 30)
      // needs to measure SLA age against.
      completedAt: { type: Date },

      diagnosis: { type: String },
      cancelReason: { type: String }, // set when status = 'cancelled'

      // ── Razorpay payment fields (Phase 2) ──────────────────────────────────
      // Going forward, an Appointment is only ever created AFTER the payment
      // signature has been verified (see Flow B) — so razorpayOrderId /
      // razorpayPaymentId / paymentStatus are always set together at
      // creation time for every new booking.
      //
      // MIGRATION NOTE (Phase 1, task 8): Appointments created before this
      // payment integration shipped have none of these fields — Mongoose
      // leaves them `undefined` on read, no default is applied retroactively.
      // Decision: do NOT default paymentStatus to 'paid' or add a 5th enum
      // value for legacy rows, since that would assert a payment that never
      // happened. Instead, any code gating on paymentStatus MUST treat a
      // missing value as "legacy / pre-payment-integration, already
      // confirmed" — not as unpaid. See scripts/migrations/001-log-legacy-appointments.js
      // for a read-only audit of how many such rows exist; it intentionally
      // does not mutate them.
      // sparse + unique: legacy appointments (no field at all) are exempt from
      // the uniqueness constraint, but once set, the same order can never
      // back two different Appointment docs — the DB itself enforces the
      // "order creation and appointment creation idempotent" requirement,
      // not just application logic (belt-and-braces against a race between
      // two concurrent requests for the same order_id).
      razorpayOrderId: { type: String, index: true, unique: true, sparse: true },
      razorpayPaymentId: { type: String, index: true },
      paymentStatus: {
         type: String,
         enum: PAYMENT_STATUS_VALUES,
      },
   },
   { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
