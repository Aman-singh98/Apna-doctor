// ─── Auth Routes ──────────────────────────────────────────────────────────────
// POST /api/auth/admin/login  → no auth required
// GET  /api/auth/admin/me     → requires JWT
const express               = require('express');
const { adminLogin, getMe } = require('../controllers/authController');
const { protect }           = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/admin/login', adminLogin);
router.get('/admin/me',     protect, getMe);

module.exports = router;
