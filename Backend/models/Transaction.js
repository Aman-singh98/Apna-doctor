// models/Transaction.js
//
// Minimal schema — created to unblock doctorProfileController.js, which
// aggregates this model for todayEarnings on the dashboard.
// Expand as you build out earningsRoutes.js / earningsController.js
// (summary totals, transaction history, payout requests).

const mongoose = require('mongoose');
const { TRANSACTION_STATUS, TRANSACTION_STATUS_VALUES } = require('../constants/paymentConstants');

const transactionSchema = new mongoose.Schema(
   {
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
      appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

      amount: { type: Number, required: true },
      type: { type: String, enum: ['consultation', 'payout'], default: 'consultation' },

      status: {
         type: String,
         enum: TRANSACTION_STATUS_VALUES, // now includes 'refunded' alongside pending/credited/failed
         default: TRANSACTION_STATUS.PENDING,
         index: true,
      },

      date: { type: Date, default: Date.now, index: true },

      // ── Razorpay Route fields (Phase 2/3) ──────────────────────────────────
      razorpayTransferId: { type: String, index: true }, // Route transfer for the doctor's share
      platformAmount: { type: Number },                  // platform's cut, for reconciliation
      onHold: { type: Boolean, default: false },          // mirrors the transfer's hold state

      // Set by jobs/transferHoldMonitorJob.js (Phase 5, task 30) the first
      // time this Transaction is flagged as stuck on_hold past the SLA, so
      // the sweep can re-alert daily instead of on every hourly run.
      staleTransferAlertSentAt: { type: Date },

   },
   { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
