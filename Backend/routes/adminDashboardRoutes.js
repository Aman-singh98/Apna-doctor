// routes/adminDashboardRoutes.js
//
// GET /api/admin/dashboard → stat cards, revenue trend, quick stats, and
// recent appointments for the Admin app's overview page.
// No auth middleware yet, matching the other admin routes in this codebase
// (adminAppointmentRoutes.js, adminPaymentRoutes.js, etc.) — add adminAuth
// here once it exists.

const express = require('express');
const { getDashboard } = require('../controllers/adminDashboardController');

const router = express.Router();

router.get('/', getDashboard);

module.exports = router;
