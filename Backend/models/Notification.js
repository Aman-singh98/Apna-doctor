const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      // patient: appointment | prescription | records | billing | system
      // doctor : appointment | payment | rating | system
    },
    title: { type: String, required: true },
    desc: { type: String, required: true },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    // e.g. { appointmentId, txnId, patientId, doctorId }
  },
  { timestamps: true }
);

// Fast "unread count" + "list mine" queries
notificationSchema.index({ recipientId: 1, read: 1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
