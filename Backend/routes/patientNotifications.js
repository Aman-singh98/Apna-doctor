const express = require('express');
const router = express.Router();
const patientProtect = require('../middleware/patientProtect');
const ctrl = require('../controllers/notificationController');

// patientProtect sets req.user = { id } only (no role field), so we tag the
// role here before it reaches the shared controller, which filters by
// req.user.role internally.
const tagRole = (req, res, next) => {
   req.user.role = 'patient';
   next();
};

router.get('/', patientProtect, tagRole, ctrl.listNotifications);
router.get('/unread-count', patientProtect, tagRole, ctrl.unreadCount);
router.patch('/read-all', patientProtect, tagRole, ctrl.markAllRead);
router.patch('/:id/read', patientProtect, tagRole, ctrl.markOneRead);
router.delete('/clear', patientProtect, tagRole, ctrl.clearAll);
router.post('/device-token', patientProtect, tagRole, ctrl.registerDeviceToken);

module.exports = router;
