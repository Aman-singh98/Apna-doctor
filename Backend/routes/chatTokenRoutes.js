// ─── routes/chatTokenRoutes.js ────────────────────────────────────────────────
// Mints a Firebase custom token for the logged-in doctor or patient, so
// Firestore rules can trust request.auth.uid == your real Mongo _id.
//
// Mount in server.js:
//   const chatTokenRoutes = require('./routes/chatTokenRoutes');
//   app.use('/api/doctor/chat',  chatTokenRoutes.doctorRouter);
//   app.use('/api/patient/chat', chatTokenRoutes.patientRouter);
//
// Resulting endpoints:
//   GET /api/doctor/chat/firebase-token
//   GET /api/patient/chat/firebase-token

const express = require('express');
const { auth } = require('../config/firebaseAdmin');

// Both are default exports (module.exports = function...), same as every
// other route file in this project — no destructuring.
const doctorProtect = require('../middleware/doctorProtect');
const patientProtect = require('../middleware/patientProtect');
const requireApprovedDoctor = require('../middleware/requireApprovedDoctor');

const doctorRouter = express.Router();
const patientRouter = express.Router();

// Matches appointmentRoutes.js / doctorReviewRoutes.js: doctor JWT + approved status.
doctorRouter.use(doctorProtect);
doctorRouter.use(requireApprovedDoctor);

doctorRouter.get('/firebase-token', async (req, res) => {
   try {
      const uid = String(req.user.id);
      const token = await auth.createCustomToken(uid, { role: 'doctor' });
      res.json({ token });
   } catch (err) {
      console.error('Failed to mint doctor Firebase token:', err);
      res.status(500).json({ message: 'Could not create chat session.' });
   }
});

patientRouter.use(patientProtect);

patientRouter.get('/firebase-token', async (req, res) => {
   try {
      const uid = String(req.user.id);
      const token = await auth.createCustomToken(uid, { role: 'patient' });
      res.json({ token });
   } catch (err) {
      console.error('Failed to mint patient Firebase token:', err);
      res.status(500).json({ message: 'Could not create chat session.' });
   }
});

module.exports = { doctorRouter, patientRouter };
