// ─── Earnings Controller (Doctor-facing) ──────────────────────────────────────
// Used by routes/earningsRoutes.js
//
// ASSUMPTIONS — adjust to match your real Mongoose schema:
//   - Model name: 'Transaction'  (one document per consultation payout)
//   - Fields assumed, based on earnings.js screen:
//       doctor    → ObjectId ref to Doctor
//       patient   → String (patient name) — or ref, your call
//       type      → 'Video' | 'Audio' | 'Chat'
//       amount     → Number
//       status     → 'credited' | 'pending'
//       date       → Date
//   - "This week" total and per-type breakdown are computed here rather than
//     stored, since they're derived from the transaction list — cheaper to
//     keep one source of truth (the transactions) than to sync two places.

const Transaction = require('../models/Transaction'); // adjust path/name if different

// GET /api/earnings/summary
exports.getEarningsSummary = async (req, res) => {
   try {
      const doctorId = req.user.id;
      const transactions = await Transaction.find({ doctor: doctorId });

      const totalEarned = transactions
         .filter(t => t.status === 'credited')
         .reduce((sum, t) => sum + t.amount, 0);

      const pending = transactions
         .filter(t => t.status === 'pending')
         .reduce((sum, t) => sum + t.amount, 0);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const thisWeek = transactions
         .filter(t => t.status === 'credited' && new Date(t.date) >= startOfWeek)
         .reduce((sum, t) => sum + t.amount, 0);

      const breakdown = ['Video', 'Audio', 'Chat'].reduce((acc, type) => {
         const ofType = transactions.filter(t => t.type === type);
         acc[type.toLowerCase()] = {
            count: ofType.length,
            amount: ofType.reduce((sum, t) => sum + t.amount, 0),
         };
         return acc;
      }, {});

      res.json({
         totalEarned,
         thisWeek,
         pending,
         consultationCount: transactions.length,
         breakdown,
      });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch earnings summary', error: err.message });
   }
};

// GET /api/earnings/transactions
exports.getTransactions = async (req, res) => {
   try {
      const transactions = await Transaction.find({ doctor: req.user.id }).sort({ date: -1 });
      res.json(transactions);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch transactions', error: err.message });
   }
};

// POST /api/earnings/payout-request
exports.requestPayout = async (req, res) => {
   try {
      // Placeholder: actual payout processing likely involves your bank
      // transfer integration, which isn't represented in the files you've
      // shared yet. For now, this just acknowledges the request — replace
      // with a real PayoutRequest record + your payment provider's API call.
      res.json({ message: 'Payout request received. Processing within 2-3 business days.' });
   } catch (err) {
      res.status(500).json({ message: 'Failed to submit payout request', error: err.message });
   }
};
