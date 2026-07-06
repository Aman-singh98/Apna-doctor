const Ticket = require('../models/Ticket');
const { notifyAllAdmins } = require('../utils/notify');

// ── @route  POST /api/patient/tickets ─────────────────────────────────────────
// ── @access Private (patient JWT) ─────────────────────────────────────────────
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
			raisedByRole: 'patient',
			patient: req.user.id, // set by patientProtect auth middleware
			category,
			subject: subject.trim(),
			description: description.trim(),
			status: 'Open',
		});

		await notifyAllAdmins({
			type: 'system',
			title: 'New Support Ticket',
			desc: `Patient raised ticket #${ticket.ticketId}: ${subject.trim()}`,
			meta: { ticketId: ticket._id },
		});

		res.status(201).json({ success: true, data: ticket });
	} catch (err) {
		next(err);
	}
};

// ── @route  GET /api/patient/tickets ──────────────────────────────────────────
// ── @access Private (patient JWT) ─────────────────────────────────────────────
exports.getMyTickets = async (req, res, next) => {
	try {
		const tickets = await Ticket.find({ raisedByRole: 'patient', patient: req.user.id }).sort({ createdAt: -1 });
		res.status(200).json({ success: true, count: tickets.length, data: tickets });
	} catch (err) {
		next(err);
	}
};

// ── @route  GET /api/patient/tickets/:id ──────────────────────────────────────
// ── @access Private (patient JWT) ─────────────────────────────────────────────
exports.getTicketById = async (req, res, next) => {
	try {
		const ticket = await Ticket.findOne({
			_id: req.params.id,
			raisedByRole: 'patient',
			patient: req.user.id, // scope to the requesting patient only
		});

		if (!ticket) {
			return res.status(404).json({ success: false, message: 'Ticket not found.' });
		}

		res.status(200).json({ success: true, data: ticket });
	} catch (err) {
		next(err);
	}
};

// ── @route  POST /api/patient/tickets/:id/replies ─────────────────────────────
// ── @access Private (patient JWT) ─────────────────────────────────────────────
exports.addPatientReply = async (req, res, next) => {
	try {
		const { message } = req.body;
		if (!message?.trim()) {
			return res.status(400).json({ success: false, message: 'message is required.' });
		}

		const ticket = await Ticket.findOne({ _id: req.params.id, raisedByRole: 'patient', patient: req.user.id });
		if (!ticket) {
			return res.status(404).json({ success: false, message: 'Ticket not found.' });
		}

		ticket.replies.push({ message: message.trim(), sender: 'patient' });
		await ticket.save();

		await notifyAllAdmins({
			type: 'system',
			title: 'New Reply on Support Ticket',
			desc: `Patient replied on ticket #${ticket.ticketId}: "${message.trim().slice(0, 60)}"`,
			meta: { ticketId: ticket._id },
		});

		res.status(200).json({ success: true, data: ticket });
	} catch (err) {
		next(err);
	}
};
