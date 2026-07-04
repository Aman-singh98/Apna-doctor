const express = require('express');
const router = express.Router();

const {
   getAllTickets,
   getTicketStats,
   getTicketByIdAdmin,
   updateTicketStatus,
   updateTicket,
   addAdminReply,
} = require('../controllers/adminTicketController');

// ⚠️ NOTE: mirroring the existing adminRoutes / adminPatientRoutes in your codebase,
// which are commented as "no auth middleware yet". Add your admin auth middleware
// here (e.g. `protectAdmin`) before going to production.
// const { protectAdmin } = require('../../middleware/authMiddleware');
// router.use(protectAdmin);

router.get('/stats', getTicketStats);           // GET   /api/admin/tickets/stats

router.route('/')
   .get(getAllTickets);                          // GET   /api/admin/tickets

router.route('/:id')
   .get(getTicketByIdAdmin)                       // GET   /api/admin/tickets/:id
   .patch(updateTicket);                          // PATCH /api/admin/tickets/:id (status/priority/assignedTo)

router.patch('/:id/status', updateTicketStatus); // PATCH /api/admin/tickets/:id/status (kept for compatibility)
router.post('/:id/replies', addAdminReply);      // POST  /api/admin/tickets/:id/replies

module.exports = router;
