// routes/accountDeletionRoutes.js
//
// Deliberately a separate route file rather than folding into
// patientMeRoutes.js / doctorMeRoutes.js, so wiring it in is a one-line
// addition to server.js instead of touching files you already have working.
//
// Patient (behind patientProtect):
//   POST /api/patient/account/delete
//   POST /api/patient/account/cancel-delete
//
// Doctor (behind middleware/auth.js — NOT doctorProtect, see controller
// comment for why):
//   POST /api/doctor/account/delete
//   POST /api/doctor/account/cancel-delete

const express = require('express');

const patientProtect = require('../middleware/patientProtect');
const doctorAuth = require('../middleware/auth');

const {
   requestPatientDeletion,
   cancelPatientDeletion,
   requestDoctorDeletion,
   cancelDoctorDeletion,
} = require('../controllers/accountDeletionController');

const patientRouter = express.Router();
patientRouter.post('/delete', patientProtect, requestPatientDeletion);
patientRouter.post('/cancel-delete', patientProtect, cancelPatientDeletion);

const doctorRouter = express.Router();
doctorRouter.post('/delete', doctorAuth, requestDoctorDeletion);
doctorRouter.post('/cancel-delete', doctorAuth, cancelDoctorDeletion);

module.exports = { patientRouter, doctorRouter };
