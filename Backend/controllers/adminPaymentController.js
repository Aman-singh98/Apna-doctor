// controllers/adminPaymentController.js
//
// Admin-facing payments view. There is no separate "Payment" collection —
// per Flow B (see models/Appointment.js), an Appointment is only ever
// created AFTER a Razorpay payment has been verified, so the Appointment
// document itself IS the payment record: razorpayOrderId / razorpayPaymentId
// / paymentStatus / fee are set together at creation time.
//
// This mirrors controllers/adminAppointmentController.js (same aggregate +
// $lookup + search pattern, same no-auth-yet state), just projected/filtered
// for the payments view instead of the appointments view.
//
// Refunds are NOT issued directly against Razorpay here — that logic
// (idempotent gateway refund + Transaction/Route-transfer bookkeeping)
// already exists in services/refundService.js (Phase 6) and is reused as-is
// so there is exactly one place in the codebase that can move money back.

const Appointment = require('../models/Appointment');
const Transaction = require('../models/Transaction');
const { refundAppointment } = require('../services/refundService');
const { PAYMENT_STATUS, PAYMENT_STATUS_VALUES } = require('../constants/paymentConstants');
const { getLabelForCategory, getSplitForCategory } = require('../config/doctorFeeConfig');

// Only appointments that actually went through the Razorpay flow count as
// "a payment" for this page — legacy pre-integration rows have no
// paymentStatus at all (see models/Appointment.js migration note) and
// shouldn't show up in a payments ledger.
const HAS_PAYMENT_RECORD = { paymentStatus: { $in: PAYMENT_STATUS_VALUES } };

// ── GET /api/admin/payments ────────────────────────────────────────────────
// Query: ?status=paid|pending|refunded|failed&search=&page=&limit=
exports.listPayments = async (req, res, next) => {
   try {
      const { status, search = '', page = 1, limit = 10 } = req.query;
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

      const match = { ...HAS_PAYMENT_RECORD };
      if (status && status !== 'All' && PAYMENT_STATUS_VALUES.includes(status.toLowerCase())) {
         match.paymentStatus = status.toLowerCase();
      }

      const pipeline = [
         { $match: match },
         {
            $lookup: {
               from: 'doctors',
               localField: 'doctor',
               foreignField: '_id',
               as: 'doctorInfo',
            },
         },
         { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
         {
            $lookup: {
               from: 'patients',
               localField: 'patient',
               foreignField: '_id',
               as: 'patientInfo',
            },
         },
         { $unwind: { path: '$patientInfo', preserveNullAndEmptyArrays: true } },
      ];

      if (search) {
         const re = new RegExp(search, 'i');
         pipeline.push({
            $match: {
               $or: [
                  { patientName: re },
                  { 'patientInfo.name': re },
                  { 'doctorInfo.name': re },
                  { razorpayOrderId: re },
                  { razorpayPaymentId: re },
               ],
            },
         });
      }

      const countResult = await Appointment.aggregate([...pipeline, { $count: 'total' }]);
      const total = countResult[0]?.total || 0;

      pipeline.push(
         { $sort: { createdAt: -1 } },
         { $skip: (pageNum - 1) * limitNum },
         { $limit: limitNum },
         {
            $project: {
               patientName: { $ifNull: ['$patientInfo.name', '$patientName'] },
               doctorName: '$doctorInfo.name',
               doctorId: '$doctorInfo._id',
               patientId: '$patientInfo._id',
               amount: '$fee',
               type: 1,
               date: 1,
               createdAt: 1,
               status: '$paymentStatus',
               razorpayOrderId: 1,
               razorpayPaymentId: 1,
            },
         }
      );

      const payments = await Appointment.aggregate(pipeline);

      res.status(200).json({
         success: true,
         total,
         page: pageNum,
         pages: Math.max(Math.ceil(total / limitNum), 1),
         payments,
      });
   } catch (err) {
      next(err);
   }
};

// ── GET /api/admin/payments/stats ──────────────────────────────────────────
exports.getPaymentStats = async (req, res, next) => {
   try {
      const [counts, totals] = await Promise.all([
         Appointment.aggregate([
            { $match: HAS_PAYMENT_RECORD },
            { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
         ]),
         Appointment.aggregate([
            { $match: { paymentStatus: PAYMENT_STATUS.PAID } },
            { $group: { _id: null, totalCollected: { $sum: '$fee' } } },
         ]),
      ]);

      const byStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
      const totalCollected = totals[0]?.totalCollected || 0;
      const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

      res.status(200).json({
         success: true,
         stats: {
            total,
            paid: byStatus[PAYMENT_STATUS.PAID] || 0,
            pending: byStatus[PAYMENT_STATUS.PENDING] || 0,
            refunded: byStatus[PAYMENT_STATUS.REFUNDED] || 0,
            failed: byStatus[PAYMENT_STATUS.FAILED] || 0,
            totalCollected,
         },
      });
   } catch (err) {
      next(err);
   }
};

// ── GET /api/admin/payments/:id ─────────────────────────────────────────────
exports.getPaymentById = async (req, res, next) => {
   try {
      const appointment = await Appointment.findOne({ _id: req.params.id, ...HAS_PAYMENT_RECORD })
         .populate('doctor', 'name email phone')
         .populate('patient', 'name phone')
         .populate('familyMember', 'name relation');

      if (!appointment) {
         return res.status(404).json({ success: false, message: 'Payment record not found.' });
      }

      res.status(200).json({ success: true, payment: appointment });
   } catch (err) {
      next(err);
   }
};

// ── GET /api/admin/payments/:id/invoice ─────────────────────────────────────
// Full invoice breakdown for one payment: the patient-facing amount, PLUS
// the doctor's share and the platform's (admin's) share, sourced from the
// linked Transaction (see models/Transaction.js — created alongside every
// paid Appointment; amount = doctor's cut, platformAmount = admin's cut).
// This is what powers the "separate doctor invoice / admin invoice" views
// in the admin panel — one call gives the frontend everything it needs to
// render all three without stitching together multiple requests.
exports.getPaymentInvoice = async (req, res, next) => {
   try {
      const appointment = await Appointment.findOne({ _id: req.params.id, ...HAS_PAYMENT_RECORD })
         .populate('doctor', 'name phone specialization category qualification regNumber hospital')
         .populate('patient', 'name phone email')
         .populate('familyMember', 'name relation');

      if (!appointment) {
         return res.status(404).json({ success: false, message: 'Payment record not found.' });
      }

      // Legacy / edge-case rows (e.g. a payment that never got a Route
      // transfer created — see paymentWebhookService.js) may have no
      // Transaction at all; the invoice still renders, just without a
      // doctor/admin split.
      const transaction = await Transaction.findOne({ appointment: appointment._id });

      const totalAmount = appointment.fee || 0;
      const doctorAmount = transaction ? transaction.amount : null;
      const platformAmount = transaction ? transaction.platformAmount : null;
      const split = appointment.doctor ? getSplitForCategory(appointment.doctor.category) : null;

      const invoiceNumber = `INV-${String(appointment._id).slice(-8).toUpperCase()}`;

      res.status(200).json({
         success: true,
         invoice: {
            invoiceNumber,
            generatedAt: new Date(),
            appointmentId: appointment._id,
            status: appointment.paymentStatus,
            consultType: appointment.type,
            appointmentDate: appointment.date,
            createdAt: appointment.createdAt,
            razorpayOrderId: appointment.razorpayOrderId || null,
            razorpayPaymentId: appointment.razorpayPaymentId || null,

            patient: {
               name: appointment.familyMember?.name || appointment.patient?.name || appointment.patientName,
               phone: appointment.patient?.phone || appointment.patientPhone || null,
               email: appointment.patient?.email || null,
               bookedFor: appointment.familyMember ? 'Family Member' : 'Self',
               relation: appointment.familyMember?.relation || null,
               accountHolder: appointment.patient?.name || null,
            },

            doctor: appointment.doctor ? {
               id: appointment.doctor._id,
               name: appointment.doctor.name,
               phone: appointment.doctor.phone,
               specialization: appointment.doctor.specialization,
               qualification: appointment.doctor.qualification,
               regNumber: appointment.doctor.regNumber,
               hospital: appointment.doctor.hospital,
               category: appointment.doctor.category,
               categoryLabel: getLabelForCategory(appointment.doctor.category),
            } : null,

            amounts: {
               total: totalAmount,
               doctorShare: doctorAmount,
               platformShare: platformAmount,
               doctorSplitPct: split?.doctor ?? null,
               platformSplitPct: split?.platform ?? null,
            },

            transaction: transaction ? {
               id: transaction._id,
               status: transaction.status,
               razorpayTransferId: transaction.razorpayTransferId || null,
               onHold: transaction.onHold,
            } : null,
         },
      });
   } catch (err) {
      next(err);
   }
};

// ── PATCH /api/admin/payments/:id/refund ────────────────────────────────────
// Body: { reason }
// Delegates the actual gateway refund + Transaction/transfer bookkeeping to
// services/refundService.js — this handler only does the HTTP-shaped
// validation and status translation.
exports.refundPayment = async (req, res, next) => {
   try {
      const { reason } = req.body;

      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
         return res.status(404).json({ success: false, message: 'Payment record not found.' });
      }

      if (appointment.paymentStatus === PAYMENT_STATUS.REFUNDED) {
         return res.status(400).json({ success: false, message: 'This payment has already been refunded.' });
      }
      if (appointment.paymentStatus !== PAYMENT_STATUS.PAID || !appointment.razorpayPaymentId) {
         return res.status(400).json({
            success: false,
            message: 'Only successfully paid transactions with a Razorpay payment ID can be refunded.',
         });
      }

      const result = await refundAppointment({
         appointment,
         reason: reason || 'Refunded by admin',
         initiatedBy: 'admin',
      });

      if (!result.refunded) {
         return res.status(502).json({
            success: false,
            message: result.message || 'The refund could not be processed by the payment gateway. Please try again or check Razorpay directly.',
         });
      }

      res.status(200).json({
         success: true,
         message: 'Refund issued successfully.',
         payment: { _id: appointment._id, status: PAYMENT_STATUS.REFUNDED },
      });
   } catch (err) {
      next(err);
   }
};
