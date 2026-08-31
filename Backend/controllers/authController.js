// ─── Auth Controller ──────────────────────────────────────────────────────────
// Admin login only. Registration is done exclusively via the seed script.
const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

// ── Helper: sign JWT ──────────────────────────────────────────────────────────
const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/admin/login
// ─────────────────────────────────────────────────────────────────────────────
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Basic presence check
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // 2. Find admin — explicitly select password (excluded by default in schema)
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // 3. Check account is active
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'This admin account has been deactivated.' });
    }

    // 4. Compare password
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // 5. Sign JWT
    const token = signToken({ id: admin._id, role: admin.role });

    // 6. Return token + safe admin object (no password)
    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      admin: {
        id:    admin._id,
        name:  admin.name,
        email: admin.email,
        role:  admin.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/admin/me
// Returns currently authenticated admin's profile (requires auth middleware)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    res.status(200).json({ success: true, admin });
  } catch (err) {
    next(err);
  }
};

module.exports = { adminLogin, getMe };
