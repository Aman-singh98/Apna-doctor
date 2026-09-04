// ─── Payments & Billing Controller (Patient-facing) ────────────────────────
// Used by routes/patientPaymentRoutes.js
//
// There is no separate "Payment" collection — per Flow B (see
// models/Appointment.js), an Appointment is only ever created AFTER a
// Razorpay payment has been verified, so the Appointment document itself IS
// the payment record: razorpayOrderId / razorpayPaymentId / paymentStatus /
// fee are set together at creation time. This mirrors
// controllers/adminPaymentController.js (same HAS_PAYMENT_RECORD filter,
// same buildInvoiceData reuse for the PDF), just scoped to the logged-in
// patient instead of open to any id.
//
// Refunds are NOT requested here against an arbitrary paid transaction —
// this codebase only ever issues a refund as a side effect of cancelling an
// upcoming appointment (see controllers/patientAppointmentController.js
// cancelAppointment -> services/refundService.js). A completed consultation
// has no self-service refund path; that's an admin-only manual action. So
// this controller reports what refunds exist and are in flight, it doesn't
// invent a new way to trigger one.

const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const { buildInvoiceData } = require('./adminPaymentController');
const { streamInvoicePdf } = require('../services/invoicePdfService');
const { PAYMENT_STATUS, PAYMENT_STATUS_VALUES } = require('../constants/paymentConstants');

const DOCTOR_FIELDS = 'name specialization';

// Legacy pre-payment-integration appointments have no paymentStatus at all
// (see models/Appointment.js migration note) and shouldn't show up in a
// payments ledger — same filter adminPaymentController.js uses.
const HAS_PAYMENT_RECORD = { paymentStatus: { $in: PAYMENT_STATUS_VALUES } };

// GET /api/patient/payments/summary
exports.getPaymentSummary = async (req, res) => {
   try {
      // Unlike Model.find(), aggregate() sends the pipeline straight to the
      // MongoDB driver with no Mongoose casting — a string patient id would
      // silently match zero documents against the ObjectId-typed `patient`
      // field, so it has to be cast explicitly here.
      const patientId = new mongoose.Types.ObjectId(req.user.id);

      const counts = await Appointment.aggregate([
         { $match: { patient: patientId, ...HAS_PAYMENT_RECORD } },
         {
            $group: {
               _id: '$paymentStatus',
               count: { $sum: 1 },
               total: { $sum: '$fee' },
            },
         },
      ]);
      const byStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: c }), {});

      const totalSpent = byStatus[PAYMENT_STATUS.PAID]?.total || 0;
      const activeCount = byStatus[PAYMENT_STATUS.PAID]?.count || 0;
      const refundedCount = byStatus[PAYMENT_STATUS.REFUNDED]?.count || 0;
      const refundedTotal = byStatus[PAYMENT_STATUS.REFUNDED]?.total || 0;

      res.json({ totalSpent, activeCount, refundedCount, refundedTotal });
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch payment summary', error: err.message });
   }
};

// GET /api/patient/payments
// Full payment history (paid + refunded + pending), most recent first.
exports.listPayments = async (req, res) => {
   try {
      const appointments = await Appointment.find({ patient: req.user.id, ...HAS_PAYMENT_RECORD })
         .populate('doctor', DOCTOR_FIELDS)
         .sort({ createdAt: -1 });

      res.json(appointments.map(a => ({
         id: a._id,
         doctorName: a.doctor?.name || 'Doctor',
         type: a.type,
         date: a.date,
         amount: a.fee,
         status: a.paymentStatus, // 'pending' | 'paid' | 'refunded' | 'failed'
         razorpayOrderId: a.razorpayOrderId || null,
         razorpayPaymentId: a.razorpayPaymentId || null,
         // A refund only exists in this codebase as a side effect of
         // cancelling an upcoming appointment — so "can this be refunded"
         // is exactly "is it still upcoming" (see cancelAppointment).
         // Completed consultations have no self-service refund path.
         refundable: a.status === 'upcoming' && a.paymentStatus === PAYMENT_STATUS.PAID,
      })));
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch payments', error: err.message });
   }
};

// GET /api/patient/payments/refunds
// Refunds only ever happen via appointment cancellation, so this is just
// the refunded slice of the same data, with the cancellation reason and
// the appointment's own `updatedAt` (the moment refundAppointment() flipped
// paymentStatus to 'refunded') standing in for a "refund date".
exports.listRefunds = async (req, res) => {
   try {
      const appointments = await Appointment.find({
         patient: req.user.id,
         paymentStatus: PAYMENT_STATUS.REFUNDED,
      })
         .populate('doctor', DOCTOR_FIELDS)
         .sort({ updatedAt: -1 });

      res.json(appointments.map(a => ({
         id: a._id,
         doctorName: a.doctor?.name || 'Doctor',
         amount: a.fee,
         date: a.updatedAt,
         reason: a.cancelReason || null,
         razorpayPaymentId: a.razorpayPaymentId || null,
         // Razorpay always refunds back to the original payment method —
         // there's no "choose a destination account" step in this flow.
         method: 'Original payment method',
      })));
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch refunds', error: err.message });
   }
};

// GET /api/patient/payments/:id/invoice/pdf
// Downloads the same patient-receipt PDF the admin panel can generate,
// scoped so a patient can only ever pull their own.
exports.downloadInvoicePdf = async (req, res) => {
   try {
      const appointment = await Appointment.findOne({ _id: req.params.id, patient: req.user.id });
      if (!appointment) {
         return res.status(404).json({ message: 'Payment record not found' });
      }

      const invoice = await buildInvoiceData(req.params.id);
      if (!invoice) {
         return res.status(404).json({ message: 'Payment record not found' });
      }
      await streamInvoicePdf(res, invoice, 'patient');
   } catch (err) {
      res.status(500).json({ message: 'Failed to generate invoice', error: err.message });
   }
};
