const express = require('express');
const router = express.Router();

const {
  createTicket,
  getMyTickets,
  getTicketById,
  addDoctorReply,
} = require('../controllers/doctorTicketController');

// ⚠️ ASSUMPTION: mirroring the patientProtect pattern noted in ticketRoutes.js —
// doctorProtect.js exports the middleware function directly
// (module.exports = function doctorProtect...) and sets req.user = { id }.
// If your doctorProtect is shaped differently (e.g. a named export, or it
// sets req.doctor instead of req.user), share it and I'll match it exactly.
const doctorProtect = require('../middleware/doctorProtect');

router.use(doctorProtect); // every route below requires a logged-in doctor

router.route('/')
  .post(createTicket)   // POST   /api/doctor/tickets
  .get(getMyTickets);   // GET    /api/doctor/tickets

router.route('/:id')
  .get(getTicketById);  // GET    /api/doctor/tickets/:id

router.route('/:id/replies')
  .post(addDoctorReply); // POST  /api/doctor/tickets/:id/replies

module.exports = router;
