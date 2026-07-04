// routes/admin.js
//
// No auth middleware yet — add it here when you build admin login.
// To protect all admin routes at once, uncomment the line below and
// create a middleware/adminAuth.js that verifies an admin JWT.
//
//   const adminAuth = require('../middleware/adminAuth');
//   router.use(adminAuth);

const express = require('express');
const { listDoctors, approveDoctor, rejectDoctor } = require('../controllers/adminController');

const router = express.Router();

router.get ('/',                     listDoctors);
router.post('/:doctorId/approve',    approveDoctor);
router.post('/:doctorId/reject',     rejectDoctor);

module.exports = router;
