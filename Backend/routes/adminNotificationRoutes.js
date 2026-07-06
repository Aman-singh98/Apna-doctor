// routes/adminNotificationRoutes.js
//
// Mirrors routes/patientNotifications.js and routes/doctorNotifications.js,
// but for admins — needed because controllers/adminTicketController.js now
// calls notifyAllAdmins() (see utils/notify.js), which creates Notification
// rows with recipientRole: 'admin'. Without this file, those rows exist in
// the DB but the admin panel has no endpoint to read them or register a
// device/browser token for push.
//
// controllers/notificationController.js is written against req.user = { id, role },
// which is what patientProtect/doctorProtect attach. middleware/authMiddleware.js's
// `protect` attaches req.admin = { id, name, email, role } instead (role here
// being the admin's own role, e.g. 'superadmin' — NOT the notification recipient
// role). Rather than forking a parallel admin-only copy of every handler, we
// reuse the same controller and adapt the shape with one small middleware.

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

// Adapt req.admin -> req.user so notificationController's existing
// { id: recipientId, role: recipientRole } reads work unchanged.
router.use((req, res, next) => {
   req.user = { id: req.admin.id, role: 'admin' };
   next();
});

router.get('/', notificationController.listNotifications);                    // GET    /api/admin/notifications
router.get('/unread-count', notificationController.unreadCount);              // GET    /api/admin/notifications/unread-count
router.patch('/read-all', notificationController.markAllRead);                // PATCH  /api/admin/notifications/read-all
router.patch('/:id/read', notificationController.markOneRead);                // PATCH  /api/admin/notifications/:id/read
router.delete('/clear', notificationController.clearAll);                     // DELETE /api/admin/notifications/clear
router.post('/device-token', notificationController.registerDeviceToken);     // POST   /api/admin/notifications/device-token

module.exports = router;
