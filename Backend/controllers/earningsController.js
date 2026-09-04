// ─── Earnings Controller (Doctor-facing) ──────────────────────────────────────
// Used by routes/earningsRoutes.js
//
// Reads real data from models/Transaction.js (one doc per consultation
// payout, created in services/paymentWebhookService.js when the patient's
// payment is captured) joined with models/Appointment.js for
// patient/consultation-type display fields that don't live on Transaction
// itself. Mirrors the aggregation style already used for the dashboard's
// `todayEarnings` stat in controllers/doctorProfileController.js.
//
// A Transaction's `amount` is already the doctor's share (platform's cut is
// tracked separately in `platformAmount`) — see paymentWebhookService.js.
// `status` starts 'pending' at payment-capture time and flips to 'credited'
// once the Razorpay Route transfer settles (webhookController.js /
// jobs/transferHoldMonitorJob.js). 'failed' transactions never became money
// owed to the doctor, so they're excluded everywhere below; 'refunded' ones
// are shown in history (the patient got their money back) but not counted
// toward earnings totals.

const Transaction = require('../models/Transaction');
const { TRANSACTION_STATUS } = require('../constants/paymentConstants');

const startOfCurrentMonth = () => {
   const d = new Date();
   d.setDate(1);
   d.setHours(0, 0, 0, 0);
   return d;
};

const startOfCurrentWeek = () => {
   const d = new Date();
   d.setDate(d.getDate() - d.getDay()); // getDay(): Sunday = 0
   d.setHours(0, 0, 0, 0);
   return d;
};

// GET /api/earnings/summary
exports.getEarningsSummary = async (req, res) => {
   try {
      const doctorId = req.user.id;
      const monthStart = startOfCurrentMonth();
      const weekStart = startOfCurrentWeek();

      const [monthTxns, pendingTxns] = await Promise.all([
         // Everything earned (or still owed) this calendar month — drives
         // the "Total Earned (this month)" card, the per-type stat row, and
         // the consultation count. Scoped by Transaction.date (payment-capture
         // time), same field doctorProfileController uses for todayEarnings.
         Transaction.find({
            doctor: doctorId,
            date: { $gte: monthStart },
            status: { $in: [TRANSACTION_STATUS.CREDITED, TRANSACTION_STATUS.PENDING] },
         }).populate('appointment', 'type'),
         // Pending balance is money still owed regardless of which month it
         // was earned in, so it's queried separately without the date filter.
         Transaction.find({ doctor: doctorId, status: TRANSACTION_STATUS.PENDING }),
      ]);

      const totalEarned = monthTxns
         .filter(t => t.status === TRANSACTION_STATUS.CREDITED)
         .reduce((sum, t) => sum + t.amount, 0);

      const thisWeek = monthTxns
         .filter(t => t.status === TRANSACTION_STATUS.CREDITED && new Date(t.date) >= weekStart)
         .reduce((sum, t) => sum + t.amount, 0);

      const pending = pendingTxns.reduce((sum, t) => sum + t.amount, 0);

      const breakdown = {
         video: { count: 0, amount: 0 },
         audio: { count: 0, amount: 0 },
         chat: { count: 0, amount: 0 },
      };
      for (const t of monthTxns) {
         const key = t.appointment?.type?.toLowerCase(); // 'Video'/'Audio'/'Chat' -> 'video'/'audio'/'chat'
         if (key && breakdown[key]) {
            breakdown[key].count += 1;
            breakdown[key].amount += t.amount;
         }
      }

      res.json({
         totalEarned,
         thisWeek,
         pending,
         consultationCount: monthTxns.length,
         breakdown,
         monthStart, // lets the frontend label the card correctly without a date library
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch earnings summary', error: err.message });
   }
};

// GET /api/earnings/transactions
// Full payout history (any month), most recent first. Excludes 'failed'
// transactions — those never became money owed to the doctor, so they'd
// just be confusing noise in a payout list.
exports.getTransactions = async (req, res) => {
   try {
      const transactions = await Transaction.find({
         doctor: req.user.id,
         status: { $ne: TRANSACTION_STATUS.FAILED },
      })
         .sort({ date: -1 })
         .populate('appointment', 'patientName type');

      res.json(transactions.map(t => ({
         id: t._id,
         patient: t.appointment?.patientName || 'Patient',
         type: t.appointment?.type || 'Video',
         date: t.date,
         amount: t.amount,
         status: t.status, // 'pending' | 'credited' | 'refunded'
      })));
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch transactions', error: err.message });
   }
};

// POST /api/earnings/payout-request
//
// There's no manual-payout system in this codebase to call into: doctor
// payouts move via Razorpay Route transfers that are created automatically
// at payment-capture time and released automatically when the consultation
// completes (controllers/appointmentController.js completeAppointment,
// backed up by jobs/transferHoldMonitorJob.js if a release ever gets
// stuck). So this endpoint can't "kick off" a transfer that isn't already
// in flight — it just reports the doctor's current pending balance honestly
// instead of pretending to submit a request into a system that doesn't
// exist yet.
exports.requestPayout = async (req, res) => {
   try {
      const pendingTxns = await Transaction.find({
         doctor: req.user.id,
         status: TRANSACTION_STATUS.PENDING,
      });
      const pending = pendingTxns.reduce((sum, t) => sum + t.amount, 0);

      if (pending === 0) {
         return res.json({
            message: 'You have no pending balance right now — everything owed to you has already been credited.',
            pending: 0,
         });
      }

      res.json({
         message: `₹${pending.toLocaleString('en-IN')} is already on its way — payouts are released automatically to your linked bank account once each consultation completes, usually within 2–3 business days.`,
         pending,
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to check payout status', error: err.message });
   }
};
