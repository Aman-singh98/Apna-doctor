const Ticket = require('../models/Ticket');
const { notifyAllAdmins } = require('../utils/notify');

// ── @route  POST /api/doctor/tickets ──────────────────────────────────────────
// ── @access Private (doctor JWT) ──────────────────────────────────────────────
exports.createTicket = async (req, res, next) => {
  try {
    const { category, subject, description } = req.body;

    if (!category || !subject?.trim() || !description?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'category, subject and description are all required.',
      });
    }

    // Ensure the generated ticketId is unique (retry on the rare collision)
    let ticketId = Ticket.generateTicketId();
    while (await Ticket.exists({ ticketId })) {
      ticketId = Ticket.generateTicketId();
    }

    const ticket = await Ticket.create({
      ticketId,
      raisedByRole: 'doctor',
      doctor: req.user.id, // set by doctorProtect auth middleware
      category,
      subject: subject.trim(),
      description: description.trim(),
      status: 'Open',
    });

    await notifyAllAdmins({
      type: 'system',
      title: 'New Support Ticket',
      desc: `Doctor raised ticket #${ticket.ticketId}: ${subject.trim()}`,
      meta: { ticketId: ticket._id },
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

// ── @route  GET /api/doctor/tickets ───────────────────────────────────────────
// ── @access Private (doctor JWT) ──────────────────────────────────────────────
exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ raisedByRole: 'doctor', doctor: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    next(err);
  }
};

// ── @route  GET /api/doctor/tickets/:id ───────────────────────────────────────
// ── @access Private (doctor JWT) ──────────────────────────────────────────────
exports.getTicketById = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      raisedByRole: 'doctor',
      doctor: req.user.id, // scope to the requesting doctor only
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

// ── @route  POST /api/doctor/tickets/:id/replies ──────────────────────────────
// ── @access Private (doctor JWT) ──────────────────────────────────────────────
exports.addDoctorReply = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'message is required.' });
    }

    const ticket = await Ticket.findOne({ _id: req.params.id, raisedByRole: 'doctor', doctor: req.user.id });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    ticket.replies.push({ message: message.trim(), sender: 'doctor' });
    await ticket.save();

    await notifyAllAdmins({
      type: 'system',
      title: 'New Reply on Support Ticket',
      desc: `Doctor replied on ticket #${ticket.ticketId}: "${message.trim().slice(0, 60)}"`,
      meta: { ticketId: ticket._id },
    });

    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};
