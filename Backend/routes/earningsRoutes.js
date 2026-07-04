// ─── Earnings Routes (Doctor-facing) ──────────────────────────────────────────
// All routes require a valid DOCTOR JWT (protect middleware).
//
// GET    /api/earnings/summary           → totals card (totalEarned, thisWeek, pending, consultationCount, breakdown by type)
// GET    /api/earnings/transactions      → payout/transaction history list
// POST   /api/earnings/payout-request    → doctor requests a manual payout
const express = require('express');
const {
  getEarningsSummary,
  getTransactions,
  requestPayout,
} = require('../controllers/earningsController');
const doctorProtect = require('../middleware/doctorProtect');

const router = express.Router();

router.use(doctorProtect);

router.get ('/summary',         getEarningsSummary);
router.get ('/transactions',    getTransactions);
router.post('/payout-request',  requestPayout);

module.exports = router;
