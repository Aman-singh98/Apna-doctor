const Ticket = require('../models/Ticket');

// ── @route  GET /api/admin/tickets?status=&category=&search=&page=&limit= ────
// ── @access Admin ──────────────────────────────────────────────────────────────
exports.getAllTickets = async (req, res, next) => {
   try {
      const { status, category, search, page = 1, limit = 20 } = req.query;

      const filter = {};
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (search) {
         filter.$or = [
            { subject: { $regex: search, $options: 'i' } },
            { ticketId: { $regex: search, $options: 'i' } },
         ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [tickets, total] = await Promise.all([
         Ticket.find(filter)
            .populate('patient', 'name email phone') // adjust fields to match your Patient model
            .populate('doctor', 'name email phone') // adjust fields to match your Doctor model
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
         Ticket.countDocuments(filter),
      ]);

      res.status(200).json({
         success: true,
         count: tickets.length,
         total,
         page: Number(page),
         pages: Math.ceil(total / Number(limit)),
         data: tickets,
      });
   } catch (err) {
      next(err);
   }
};

// ── @route  GET /api/admin/tickets/stats ──────────────────────────────────────
// ── @access Admin ──────────────────────────────────────────────────────────────
exports.getTicketStats = async (req, res, next) => {
   try {
      const counts = await Ticket.aggregate([
         { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const stats = { Open: 0, 'In Progress': 0, Resolved: 0 };
      counts.forEach((c) => {
         stats[c._id] = c.count;
      });

      res.status(200).json({ success: true, data: stats });
   } catch (err) {
      next(err);
   }
};

// ── @route  GET /api/admin/tickets/:id ────────────────────────────────────────
// ── @access Admin ──────────────────────────────────────────────────────────────
exports.getTicketByIdAdmin = async (req, res, next) => {
   try {
      const ticket = await Ticket.findById(req.params.id)
         .populate('patient', 'name email phone')
         .populate('doctor', 'name email phone');
      if (!ticket) {
         return res.status(404).json({ success: false, message: 'Ticket not found.' });
      }
      res.status(200).json({ success: true, data: ticket });
   } catch (err) {
      next(err);
   }
};

// ── @route  PATCH /api/admin/tickets/:id/status ───────────────────────────────
// ── @access Admin ──────────────────────────────────────────────────────────────
exports.updateTicketStatus = async (req, res, next) => {
   try {
      const { status } = req.body;
      if (!['Open', 'In Progress', 'Resolved'].includes(status)) {
         return res.status(400).json({ success: false, message: 'Invalid status value.' });
      }

      const ticket = await Ticket.findByIdAndUpdate(
         req.params.id,
         { status },
         { new: true, runValidators: true }
      );

      if (!ticket) {
         return res.status(404).json({ success: false, message: 'Ticket not found.' });
      }

      res.status(200).json({ success: true, data: ticket });
   } catch (err) {
      next(err);
   }
};

// ── @route  PATCH /api/admin/tickets/:id ──────────────────────────────────────
// ── @access Admin ──────────────────────────────────────────────────────────────
// General-purpose update for the admin panel: any of status / priority / assignedTo.
exports.updateTicket = async (req, res, next) => {
   try {
      const { status, priority, assignedTo } = req.body;
      const updates = {};

      if (status !== undefined) {
         if (!['Open', 'In Progress', 'Resolved'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value.' });
         }
         updates.status = status;
      }

      if (priority !== undefined) {
         if (!['Low', 'Medium', 'High'].includes(priority)) {
            return res.status(400).json({ success: false, message: 'Invalid priority value.' });
         }
         updates.priority = priority;
      }

      if (assignedTo !== undefined) {
         updates.assignedTo = String(assignedTo).trim();
      }

      if (Object.keys(updates).length === 0) {
         return res.status(400).json({ success: false, message: 'No valid fields to update.' });
      }

      const ticket = await Ticket.findByIdAndUpdate(req.params.id, updates, {
         new: true,
         runValidators: true,
      })
         .populate('patient', 'name email phone')
         .populate('doctor', 'name email phone');

      if (!ticket) {
         return res.status(404).json({ success: false, message: 'Ticket not found.' });
      }

      res.status(200).json({ success: true, data: ticket });
   } catch (err) {
      next(err);
   }
};

// ── @route  POST /api/admin/tickets/:id/replies ───────────────────────────────
// ── @access Admin ──────────────────────────────────────────────────────────────
exports.addAdminReply = async (req, res, next) => {
   try {
      const { message, senderName } = req.body;
      if (!message?.trim()) {
         return res.status(400).json({ success: false, message: 'message is required.' });
      }

      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) {
         return res.status(404).json({ success: false, message: 'Ticket not found.' });
      }

      ticket.replies.push({ message: message.trim(), sender: 'admin', senderName: senderName || 'Support Team' });
      // Replying moves an Open ticket into In Progress automatically
      if (ticket.status === 'Open') ticket.status = 'In Progress';
      await ticket.save();
      await ticket.populate('patient', 'name email phone');
      await ticket.populate('doctor', 'name email phone');

      res.status(200).json({ success: true, data: ticket });
   } catch (err) {
      next(err);
   }
};
