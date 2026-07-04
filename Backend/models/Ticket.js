const mongoose = require('mongoose');

// ── Reply sub-schema ──────────────────────────────────────────────────────────
// Each ticket can have a thread of replies from whoever raised it (patient or
// doctor) or an admin.
const replySchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true },
    sender: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
    senderName: { type: String, default: '' }, // e.g. admin's display name
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    // Human-readable ID shown in the app, e.g. "TKT89012"
    ticketId: { type: String, required: true, unique: true, index: true },

    // Every ticket is raised by exactly one patient OR one doctor.
    // `raisedByRole` says which one to look at — keeps a single admin
    // inbox/collection instead of two separate ticket models.
    raisedByRole: {
      type: String,
      enum: ['patient', 'doctor'],
      required: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      index: true,
      required: function () { return this.raisedByRole === 'patient'; },
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      index: true,
      required: function () { return this.raisedByRole === 'doctor'; },
    },

    category: {
      type: String,
      enum: ['Billing', 'Doctor Consult', 'Records', 'Technical'],
      required: true,
    },

    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved'],
      default: 'Open',
      index: true,
    },

    // Admin-only triage fields — neither patients nor doctors ever set these
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
      index: true,
    },
    assignedTo: { type: String, default: '' }, // support agent's display name for now

    replies: [replySchema],
  },
  { timestamps: true } // createdAt / updatedAt
);

// Generates a unique-enough ticket ID like "TKT48213"
ticketSchema.statics.generateTicketId = function () {
  return `TKT${Math.floor(10000 + Math.random() * 90000)}`;
};

module.exports = mongoose.model('Ticket', ticketSchema);
