// ─── Auth Middleware ──────────────────────────────────────────────────────────
// Validates the Bearer JWT on every protected route.
// Attaches the decoded admin payload to req.admin.
const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided. Access denied.' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify signature + expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check admin still exists and is active
    const admin = await Admin.findById(decoded.id).select('_id name email role isActive');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Admin account not found or deactivated.' });
    }

    // 4. Attach to request for downstream use
    req.admin = { id: admin._id, name: admin.name, email: admin.email, role: admin.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    next(err);
  }
};

// ── Role guard (future use if you add sub-admins) ─────────────────────────────
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission for this action.' });
  }
  next();
};

module.exports = { protect, restrictTo };
