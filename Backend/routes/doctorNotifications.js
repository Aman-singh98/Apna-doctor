const express = require('express');
const router = express.Router();
const doctorProtect = require('../middleware/doctorProtect');
const ctrl = require('../controllers/notificationController');

// doctorProtect sets req.user = { id, name, phone } (no role field), so tag
// it here before the shared controller, which filters by req.user.role.
const tagRole = (req, res, next) => {
   req.user.role = 'doctor';
   next();
};

router.get('/', doctorProtect, tagRole, ctrl.listNotifications);
router.get('/unread-count', doctorProtect, tagRole, ctrl.unreadCount);
router.patch('/read-all', doctorProtect, tagRole, ctrl.markAllRead);
router.patch('/:id/read', doctorProtect, tagRole, ctrl.markOneRead);
router.delete('/clear', doctorProtect, tagRole, ctrl.clearAll);
router.post('/device-token', doctorProtect, tagRole, ctrl.registerDeviceToken);

module.exports = router;
