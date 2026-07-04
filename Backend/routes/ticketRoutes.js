const express = require('express');
const router = express.Router();

const {
  createTicket,
  getMyTickets,
  getTicketById,
  addPatientReply,
} = require('../controllers/ticketController');

// patientProtect.js exports the function directly (module.exports = function patientProtect...),
// so this must be a default import, not a destructured one. It sets req.user = { id }.
const patientProtect = require('../middleware/patientProtect');

router.use(patientProtect); // every route below requires a logged-in patient

router.route('/')
  .post(createTicket)   // POST   /api/patient/tickets
  .get(getMyTickets);   // GET    /api/patient/tickets

router.route('/:id')
  .get(getTicketById);  // GET    /api/patient/tickets/:id

router.route('/:id/replies')
  .post(addPatientReply); // POST  /api/patient/tickets/:id/replies

module.exports = router;
