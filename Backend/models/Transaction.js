// models/Transaction.js
//
// Minimal schema — created to unblock doctorProfileController.js, which
// aggregates this model for todayEarnings on the dashboard.
// Expand as you build out earningsRoutes.js / earningsController.js
// (summary totals, transaction history, payout requests).

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
   {
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
      appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

      amount: { type: Number, required: true },
      type: { type: String, enum: ['consultation', 'payout'], default: 'consultation' },

      status: {
         type: String,
         enum: ['pending', 'credited', 'failed'],
         default: 'pending',
         index: true,
      },

      date: { type: Date, default: Date.now, index: true },
   },
   { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
