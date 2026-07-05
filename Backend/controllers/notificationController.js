const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');

// GET /api/notifications?page=1&limit=20
// Assumes your auth middleware sets req.user = { id, role }
exports.listNotifications = async (req, res) => {
   try {
      const { id: recipientId, role } = req.user;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const notifs = await Notification.find({ recipientId, recipientRole: role })
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean();

      res.json(notifs);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
   }
};

// GET /api/notifications/unread-count
exports.unreadCount = async (req, res) => {
   try {
      const { id: recipientId, role } = req.user;
      const count = await Notification.countDocuments({
         recipientId,
         recipientRole: role,
         read: false,
      });
      res.json({ count });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch unread count', error: err.message });
   }
};

// PATCH /api/notifications/:id/read
exports.markOneRead = async (req, res) => {
   try {
      const { id: recipientId } = req.user;
      const notif = await Notification.findOneAndUpdate(
         { _id: req.params.id, recipientId }, // guard: can only mark your own
         { read: true },
         { new: true }
      );
      if (!notif) return res.status(404).json({ message: 'Notification not found' });
      res.json(notif);
   } catch (err) {
      res.status(500).json({ message: 'Failed to update notification', error: err.message });
   }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
   try {
      const { id: recipientId, role } = req.user;
      await Notification.updateMany(
         { recipientId, recipientRole: role, read: false },
         { read: true }
      );
      res.json({ message: 'All notifications marked as read' });
   } catch (err) {
      res.status(500).json({ message: 'Failed to update notifications', error: err.message });
   }
};

// DELETE /api/notifications/clear
exports.clearAll = async (req, res) => {
   try {
      const { id: recipientId, role } = req.user;
      await Notification.deleteMany({ recipientId, recipientRole: role });
      res.json({ message: 'Notifications cleared' });
   } catch (err) {
      res.status(500).json({ message: 'Failed to clear notifications', error: err.message });
   }
};

// POST /api/notifications/device-token   { token, platform }
exports.registerDeviceToken = async (req, res) => {
   try {
      const { id: userId, role } = req.user;
      const { token, platform } = req.body;
      if (!token) return res.status(400).json({ message: 'token is required' });

      await DeviceToken.findOneAndUpdate(
         { token },
         { userId, role, token, platform: platform || 'android' },
         { upsert: true, new: true }
      );
      res.json({ message: 'Device token registered' });
   } catch (err) {
      res.status(500).json({ message: 'Failed to register device token', error: err.message });
   }
};
