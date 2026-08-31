// No auth middleware yet — matches the current state of routes/admin.js
// (doctor admin routes). Add an adminAuth middleware here once admin
// login exists, the same way you'll add it to routes/admin.js.
//
//   const adminAuth = require('../middleware/adminAuth');
//   router.use(adminAuth);

const express = require('express');
const {
   listPatients,
   getPatientStats,
   getPatientById,
   suspendPatient,
   unsuspendPatient,
   cancelPatientDeletion,
   finalizePatientDeletionNow,
} = require('../../controllers/adminPatientController');

const router = express.Router();

router.get('/stats', getPatientStats);
router.get('/', listPatients);
router.get('/:id', getPatientById);
router.patch('/:id/suspend', suspendPatient);
router.patch('/:id/unsuspend', unsuspendPatient);
router.patch('/:id/cancel-deletion', cancelPatientDeletion);
router.patch('/:id/finalize-deletion', finalizePatientDeletionNow);

module.exports = router;
