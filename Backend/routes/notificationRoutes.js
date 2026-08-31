// ─── Notification Routes (Doctor-facing) ──────────────────────────────────────
// All routes require a valid DOCTOR JWT (protect middleware).
// Scoped to the logged-in doctor only.
//
// GET    /api/notifications              → list doctor's notifications
// PATCH  /api/notifications/:id/read     → mark single notification as read
// PATCH  /api/notifications/read-all     → mark all as read
const express = require('express');
const {
  getNotifications,
  markRead,
  markAllRead,
} = require('../controllers/notificationController');
const doctorProtect = require('../middleware/doctorProtect');

const router = express.Router();

router.use(doctorProtect);

// NOTE: /read-all must be defined BEFORE /:id/read so Express doesn't treat
// "read-all" as an :id
router.patch('/read-all',     markAllRead);

router.get  ('/',             getNotifications);
router.patch('/:id/read',     markRead);

module.exports = router;
