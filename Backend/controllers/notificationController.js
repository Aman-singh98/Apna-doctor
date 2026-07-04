// ─── Notification Controller (Doctor-facing) ──────────────────────────────────
// Used by routes/notificationRoutes.js
//
// ASSUMPTIONS — adjust to match your real Mongoose schema:
//   - Model name: 'Notification'
//   - Fields assumed, based on notifications.js screen:
//       doctor    → ObjectId ref to Doctor (the recipient)
//       type      → 'appointment' | 'payment' | 'rating' | 'system'
//       title     → String
//       desc      → String
//       read      → Boolean (screen calls this "unread", inverted here —
//                   storing as `read` is usually cleaner since new
//                   notifications default to read: false)
//       createdAt → Date (Mongoose timestamps can handle this automatically)

const Notification = require('../models/Notification'); // adjust path/name if different

// GET /api/notifications
exports.getNotifications = async (req, res) => {
   try {
      const notifications = await Notification.find({ doctor: req.user.id })
         .sort({ createdAt: -1 });
      res.json(notifications);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
   }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
   try {
      const notification = await Notification.findOneAndUpdate(
         { _id: req.params.id, doctor: req.user.id },
         { read: true },
         { new: true }
      );

      if (!notification) {
         return res.status(404).json({ message: 'Notification not found' });
      }
      res.json(notification);
   } catch (err) {
      res.status(500).json({ message: 'Failed to mark notification as read', error: err.message });
   }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
   try {
      await Notification.updateMany(
         { doctor: req.user.id, read: false },
         { read: true }
      );
      res.json({ message: 'All notifications marked as read' });
   } catch (err) {
      res.status(500).json({ message: 'Failed to mark all as read', error: err.message });
   }
};
