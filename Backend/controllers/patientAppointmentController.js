// ─── Appointment Controller (Patient-facing) ──────────────────────────────────
// Used by routes/patient/appointments.js
//
// Distinct from controllers/appointmentController.js (doctor-facing). This one
// scopes every query by `patient: req.user.id` instead of `doctor`, and
// populates the doctor's name/specialization since that's what the patient
// app needs to display (see app/patient/appointments.js).
//
// ASSUMPTIONS — adjust if wrong:
//   - patientProtect sets req.user.id to the logged-in Patient's _id
//     (same convention as doctorProtect / req.user.id used elsewhere).
//   - Appointment.patient is populated from the booking flow (book-appointment.js
//     backend) — make sure that write path sets `patient: req.user.id` too.

const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const FamilyMember = require('../models/FamilyMember');
const Transaction = require('../models/Transaction');
const PendingPaymentOrder = require('../models/PendingPaymentOrder');
const { notify } = require('../utils/notify');
const razorpayService = require('../services/razorpayService');
const refundService = require('../services/refundService');
const { getFeesForCategory, getSplitForCategory } = require('../config/doctorFeeConfig');
const { PAYMENT_STATUS, TRANSACTION_STATUS } = require('../constants/paymentConstants');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');

const DOCTOR_FIELDS = 'name specialization photoUrl';

const TYPE_TO_FEE_KEY = { Video: 'video', Audio: 'audio', Chat: 'chat' };

// Deterministic key for a given (patient, doctor, type, familyMember, date)
// booking attempt — lets a retried create-order call return the SAME
// Razorpay order instead of creating a new one every time (Phase 2, task 15).
// `date` is included so that picking a different slot always starts a new
// order rather than accidentally reusing one minted for an earlier slot
// selection within the same idle-30-min window.
function buildIdempotencyKey({ patientId, doctorId, type, familyMemberId, date }) {
   return crypto
      .createHash('sha256')
      .update(`${patientId}:${doctorId}:${type}:${familyMemberId || 'self'}:${date}`)
      .digest('hex');
}

// POST /api/patient/appointments/create-order
// body: { doctorId, type: 'Video'|'Audio'|'Chat', familyMemberId? }
//
// Creates a Razorpay order for the consultation fee, computed entirely
// server-side from config/doctorFeeConfig.js — the client never sends, and
// this endpoint never trusts, an amount. Does NOT create an Appointment;
// that only happens after payment is verified (see createAppointment below).
exports.createOrder = async (req, res) => {
   try {
      const { doctorId, type, familyMemberId, date } = req.body;

      if (!doctorId || !type || !date) {
         return res.status(400).json({ message: 'doctorId, type, and date are required' });
      }
      if (!['Video', 'Audio', 'Chat'].includes(type)) {
         return res.status(400).json({ message: "type must be 'Video', 'Audio', or 'Chat'" });
      }
      const apptDate = new Date(date);
      if (isNaN(apptDate.getTime())) {
         return res.status(400).json({ message: 'A valid date is required' });
      }

      const doctor = await Doctor.findOne({ _id: doctorId, approvalStatus: 'approved' });
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found or not currently accepting bookings' });
      }

      if (familyMemberId) {
         const familyMember = await FamilyMember.findOne({ _id: familyMemberId, patient: req.user.id });
         if (!familyMember) {
            return res.status(404).json({ message: 'Family member not found' });
         }
      }

      // ── Idempotency (task 15): a retried create-order call for the same
      // in-flight booking attempt returns the SAME order instead of minting
      // a new one every time (double-tap on "Book & Pay", app retry, etc).
      const idempotencyKey = buildIdempotencyKey({
         patientId: req.user.id,
         doctorId: doctor._id,
         type,
         familyMemberId,
         date: apptDate.toISOString(),
      });
      const existing = await PendingPaymentOrder.findOne({ idempotencyKey });
      if (existing) {
         logEvent('order.reused', { orderId: existing.razorpayOrderId }, { reason: 'idempotent-retry' });
         return res.status(200).json({
            orderId: existing.razorpayOrderId,
            amount: razorpayService.toPaise(existing.totalAmount),
            currency: razorpayService.CURRENCY,
            keyId: process.env.RAZORPAY_KEY_ID,
         });
      }

      // ── Fee + split, looked up server-side from doctorFeeConfig.js ONLY.
      // Never derived from anything the client sent.
      const feeKey = TYPE_TO_FEE_KEY[type];
      const fees = getFeesForCategory(doctor.category);
      const split = getSplitForCategory(doctor.category);
      const totalAmount = fees[feeKey];
      if (!totalAmount || totalAmount <= 0 || !split) {
         // Doctor has no (or an unrecognized) category — nothing to charge.
         return res.status(422).json({ message: 'This doctor is not yet configured to accept payments. Please try another doctor.' });
      }
      const doctorAmount = Math.round((totalAmount * split.doctor) / 100 * 100) / 100;
      const platformAmount = Math.round((totalAmount - doctorAmount) * 100) / 100;

      // Receipt must be <= 40 chars for Razorpay; keep it short but traceable.
      const receipt = `apt_${doctor._id.toString().slice(-8)}_${Date.now()}`;

      const order = await razorpayService.createOrder({
         amountInRupees: totalAmount,
         receipt,
         // `date` and `familyMemberId` are included here (not just stored in
         // PendingPaymentOrder below) so that Phase 4's payment.captured
         // webhook safety net can still reconstruct the booking from the
         // Razorpay payload's own notes even in the rare case where
         // PendingPaymentOrder has already expired (30-min TTL) by the time
         // the webhook lands — see services/paymentWebhookService.js.
         notes: {
            doctorId: String(doctor._id),
            patientId: String(req.user.id),
            type,
            date: apptDate.toISOString(),
            ...(familyMemberId ? { familyMemberId: String(familyMemberId) } : {}),
         },
      });

      await PendingPaymentOrder.create({
         idempotencyKey,
         razorpayOrderId: order.id,
         patient: req.user.id,
         doctor: doctor._id,
         familyMember: familyMemberId || null,
         type,
         date: apptDate,
         totalAmount,
         doctorAmount,
         platformAmount,
      });

      logEvent('order.created', { orderId: order.id }, { doctorId: String(doctor._id), type, totalAmount });

      res.status(201).json({
         orderId: order.id,
         amount: order.amount, // paise, exactly what Checkout expects
         currency: order.currency,
         keyId: process.env.RAZORPAY_KEY_ID,
      });
   } catch (err) {
      logEvent('order.create_failed', {}, { message: err.message });
      res.status(500).json({ message: 'Failed to create payment order', error: err.message });
   }
};

// POST /api/patient/appointments
// body: { doctorId, date (ISO string), type: 'Video'|'Audio'|'Chat', familyMemberId?,
//         razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// SECURITY: this is the signature-verification boundary. `fee`/`amount` are
// deliberately NOT accepted from the client at all — the true amount was
// already fixed server-side when the order was created (createOrder above)
// and is looked back up from PendingPaymentOrder by razorpay_order_id.
// Nothing is created (no Appointment, no Transaction, no transfer) unless
// the HMAC signature verifies.
//
// If familyMemberId is omitted, the appointment is booked for the patient themselves.
exports.createAppointment = async (req, res) => {
   try {
      const {
         doctorId,
         date,
         type,
         familyMemberId,
         patientName: bodyPatientName,
         razorpay_order_id: razorpayOrderId,
         razorpay_payment_id: razorpayPaymentId,
         razorpay_signature: razorpaySignature,
      } = req.body;

      if (!doctorId || !date || !type) {
         return res.status(400).json({ message: 'doctorId, date, and type are required' });
      }
      if (!['Video', 'Audio', 'Chat'].includes(type)) {
         return res.status(400).json({ message: "type must be 'Video', 'Audio', or 'Chat'" });
      }
      const apptDate = new Date(date);
      if (isNaN(apptDate.getTime())) {
         return res.status(400).json({ message: 'A valid date is required' });
      }
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
         return res.status(400).json({ message: 'Payment could not be verified, please try again.' });
      }

      // ── Idempotency (task 15): if this order already produced an
      // Appointment (retried request, or a race with the Phase 4 webhook
      // safety net once that exists), return the existing one rather than
      // erroring or double-creating. The DB's unique index on
      // razorpayOrderId is the final backstop against a true race.
      const alreadyCreated = await Appointment.findOne({ razorpayOrderId });
      if (alreadyCreated) {
         return res.status(200).json(await alreadyCreated.populate('doctor', DOCTOR_FIELDS));
      }

      // ── Signature verification — the security boundary. Constant-time
      // comparison happens inside razorpayService, never `===` here.
      const signatureValid = razorpayService.verifyPaymentSignature({
         orderId: razorpayOrderId,
         paymentId: razorpayPaymentId,
         signature: razorpaySignature,
      });
      if (!signatureValid) {
         // Per Flow F: create nothing, generic message to the client, real
         // reason (there isn't one to leak here beyond "mismatch", but the
         // event itself is what monitoring alerts on) logged server-side only.
         logSecurityEvent('signature.verification_failed', { orderId: razorpayOrderId, paymentId: razorpayPaymentId });
         return res.status(400).json({ message: 'Payment could not be verified, please try again.' });
      }

      // ── Look up the authoritative amount/doctor/type from the order we
      // created server-side — never from this request's body.
      const pendingOrder = await PendingPaymentOrder.findOne({ razorpayOrderId });
      // From here on, prefer the slot that was fixed at order-creation time
      // over whatever this request's body says — same "authoritative
      // server-side record, not client-echoed input" rule already applied
      // to the amount below. This also keeps this path and Phase 4's
      // payment.captured webhook safety net (which only ever has
      // pendingOrder.date to work with) producing an identical Appointment
      // for the same order, whichever path wins the race.
      if (pendingOrder && pendingOrder.date) {
         apptDate.setTime(pendingOrder.date.getTime());
      }
      if (!pendingOrder) {
         // Signature is genuinely valid but we have no record of creating
         // this order (expired past its 30-min TTL, or paid without our
         // create-order step ever running). Flow E's webhook is the proper
         // safety net for this (Phase 4); until then, fail closed rather
         // than trusting client-sent amounts as a fallback.
         logSecurityEvent('order.unrecognized', { orderId: razorpayOrderId, paymentId: razorpayPaymentId });
         return res.status(409).json({ message: 'This payment session has expired. If you were charged, contact support with your payment ID.' });
      }
      if (String(pendingOrder.patient) !== String(req.user.id) || String(pendingOrder.doctor) !== String(doctorId) || pendingOrder.type !== type) {
         logSecurityEvent('order.mismatch', { orderId: razorpayOrderId, paymentId: razorpayPaymentId });
         return res.status(409).json({ message: 'This payment does not match the requested booking.' });
      }

      const doctor = await Doctor.findOne({ _id: pendingOrder.doctor, approvalStatus: 'approved' });
      if (!doctor) {
         return res.status(404).json({ message: 'Doctor not found or not currently accepting bookings' });
      }

      let patientName = req.user.name || bodyPatientName;
      let familyMember = null;
      if (pendingOrder.familyMember) {
         familyMember = await FamilyMember.findOne({ _id: pendingOrder.familyMember, patient: req.user.id });
         if (!familyMember) {
            return res.status(404).json({ message: 'Family member not found' });
         }
         patientName = familyMember.name;
      }

      // Prevent double-booking the same doctor slot. Per Flow F: whichever
      // payment verifies first wins the slot; the loser gets refunded
      // (Phase 6, task 56) rather than left with a captured payment and no
      // booking. issueRefund is idempotent (see refundService) so this is
      // safe even if the payment.captured webhook safety net reacts to the
      // same clash concurrently.
      const clash = await Appointment.findOne({
         doctor: doctor._id,
         date: apptDate,
         status: 'upcoming',
      });
      if (clash) {
         logEvent('booking.slot_clash', { orderId: razorpayOrderId, paymentId: razorpayPaymentId }, { doctorId: String(doctor._id) });
         await refundService.refundCapturedPayment({
            paymentId: razorpayPaymentId,
            reason: 'slot_clash',
            correlationIds: { orderId: razorpayOrderId },
         });
         // This order has been fully resolved (refunded, not booked) — clean
         // up now rather than waiting on TTL, same as the happy-path cleanup
         // further down, so a stray retry can't hand it back as if still live.
         await PendingPaymentOrder.deleteOne({ _id: pendingOrder._id }).catch(() => {});
         return res.status(409).json({
            message: 'This slot was just taken — you\'ve been refunded.',
         });
      }

      let appointment;
      try {
         appointment = await Appointment.create({
            doctor: doctor._id,
            patient: req.user.id,
            familyMember: familyMember ? familyMember._id : null,
            patientName,
            patientPhone: req.user.phone, // ASSUMPTION: req.user carries phone; adjust if not.
            date: apptDate,
            type,
            status: 'upcoming',
            fee: pendingOrder.totalAmount, // server-computed at order-creation time, not client-sent
            razorpayOrderId,
            razorpayPaymentId,
            paymentStatus: PAYMENT_STATUS.PAID,
         });
      } catch (err) {
         // Unique-index race: two requests for the same order both passed
         // the findOne-above check before either inserted. Whoever loses
         // the race just returns the winner's Appointment instead of erroring.
         if (err.code === 11000) {
            const winner = await Appointment.findOne({ razorpayOrderId });
            if (winner) return res.status(200).json(await winner.populate('doctor', DOCTOR_FIELDS));
         }
         throw err;
      }

      // ── Route transfer, held until consultation completion (Phase 5
      // releases it). If the doctor has no linked Route account yet
      // (Phase 3 onboarding not done for them), skip the transfer rather
      // than failing the whole booking — the platform still holds the full
      // amount; reconciliation can create the transfer later via the Admin
      // app once the doctor's account is active.
      let transaction;
      if (doctor.razorpayAccountId) {
         try {
            const transfer = await razorpayService.createRouteTransfer({
               paymentId: razorpayPaymentId,
               doctorAccountId: doctor.razorpayAccountId,
               amountInRupees: pendingOrder.doctorAmount,
               onHold: true,
            });
            transaction = await Transaction.create({
               doctor: doctor._id,
               appointment: appointment._id,
               amount: pendingOrder.doctorAmount, // doctor's share — matches earningsController.js semantics
               status: TRANSACTION_STATUS.PENDING,
               razorpayTransferId: transfer.id,
               platformAmount: pendingOrder.platformAmount,
               onHold: true,
            });
            logEvent('transfer.created', { orderId: razorpayOrderId, paymentId: razorpayPaymentId, transferId: transfer.id, appointmentId: String(appointment._id) });
         } catch (err) {
            // The payment is captured and the Appointment is confirmed either
            // way — a transfer failure must not undo the booking. Log loudly
            // so Admin reconciliation (Phase 9) can create the transfer
            // manually; do not throw.
            logSecurityEvent('transfer.create_failed', { orderId: razorpayOrderId, paymentId: razorpayPaymentId, appointmentId: String(appointment._id) }, { message: err.message });
            transaction = await Transaction.create({
               doctor: doctor._id,
               appointment: appointment._id,
               amount: pendingOrder.doctorAmount,
               status: TRANSACTION_STATUS.PENDING,
               platformAmount: pendingOrder.platformAmount,
               onHold: true,
            });
         }
      } else {
         logEvent('transfer.skipped_no_linked_account', { orderId: razorpayOrderId, appointmentId: String(appointment._id) }, { doctorId: String(doctor._id) });
         transaction = await Transaction.create({
            doctor: doctor._id,
            appointment: appointment._id,
            amount: pendingOrder.doctorAmount,
            status: TRANSACTION_STATUS.PENDING,
            platformAmount: pendingOrder.platformAmount,
            onHold: true,
         });
      }

      // Pending order has served its purpose (Appointment now exists as the
      // permanent record) — safe to clean up early rather than waiting on TTL.
      await PendingPaymentOrder.deleteOne({ _id: pendingOrder._id }).catch(() => {});

      logEvent('appointment.paid', { orderId: razorpayOrderId, paymentId: razorpayPaymentId, appointmentId: String(appointment._id) });

      await notify({
         recipientId: doctor._id,
         recipientRole: 'doctor',
         type: 'appointment',
         title: 'New Appointment Booked',
         desc: `${patientName} booked a ${type} consultation with you.`,
         meta: { appointmentId: appointment._id },
      });

      res.status(201).json(await appointment.populate('doctor', DOCTOR_FIELDS));
   } catch (err) {
      res.status(500).json({ message: 'Failed to book appointment', error: err.message });
   }
};

// GET /api/patient/appointments
// Returns ALL of the patient's appointments (upcoming, completed, cancelled).
// The app buckets them into "Upcoming" vs "Past" tabs on the frontend, since
// "past" there means completed OR cancelled.
exports.getAppointments = async (req, res) => {
   try {
      const appointments = await Appointment.find({ patient: req.user.id })
         .populate('doctor', DOCTOR_FIELDS)
         .sort({ date: -1 });

      res.json(appointments);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointments', error: err.message });
   }
};

// GET /api/patient/appointments/:id
exports.getAppointmentById = async (req, res) => {
   try {
      const appointment = await Appointment.findOne({
         _id: req.params.id,
         patient: req.user.id, // ensures a patient can't fetch someone else's appointment
      }).populate('doctor', DOCTOR_FIELDS);

      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      res.json(appointment);
   } catch (err) {
      res.status(500).json({ message: 'Failed to fetch appointment', error: err.message });
   }
};

// PATCH /api/patient/appointments/:id/cancel
// body: { reason }
//
// Phase 6, tasks 31/33: on top of the status flip, this now issues a full
// refund on the original payment (idempotently) via refundService.
exports.cancelAppointment = async (req, res) => {
   try {
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
         return res.status(400).json({ message: 'Cancellation reason is required' });
      }

      // Atomic status transition — the { status: 'upcoming' } filter is what
      // makes this idempotent, same pattern as completeAppointment (Phase 5):
      // only the request that actually flips 'upcoming' -> 'cancelled' goes
      // on to issue a refund. A retried/duplicate cancel request for an
      // already-cancelled appointment must never trigger a second refund
      // attempt against Razorpay.
      const appointment = await Appointment.findOneAndUpdate(
         { _id: req.params.id, patient: req.user.id, status: 'upcoming' },
         { status: 'cancelled', cancelReason: reason },
         { new: true }
      );

      if (!appointment) {
         const existing = await Appointment.findOne({ _id: req.params.id, patient: req.user.id });
         if (!existing) {
            return res.status(404).json({ message: 'Appointment not found' });
         }
         if (existing.status === 'cancelled') {
            // Already cancelled — no-op. The refund attempt already ran (or
            // was attempted) on the request that actually made this
            // transition; never re-run it here.
            return res.json(await existing.populate('doctor', DOCTOR_FIELDS));
         }
         return res.status(400).json({ message: 'Only upcoming appointments can be cancelled' });
      }

      await refundService.refundAppointment({ appointment, reason, initiatedBy: 'patient' });

      await notify({
         recipientId: appointment.doctor,
         recipientRole: 'doctor',
         type: 'appointment',
         title: 'Appointment Cancelled',
         desc: `${appointment.patientName} cancelled their upcoming ${appointment.type} consultation. Reason: ${reason}`,
         meta: { appointmentId: appointment._id },
      });

      res.json(await appointment.populate('doctor', DOCTOR_FIELDS));
   } catch (err) {
      res.status(500).json({ message: 'Failed to cancel appointment', error: err.message });
   }
};

// PATCH /api/patient/appointments/:id/reschedule
// body: { date }  — ISO datetime string for the new slot
exports.rescheduleAppointment = async (req, res) => {
   try {
      const { date } = req.body;
      if (!date || isNaN(new Date(date).getTime())) {
         return res.status(400).json({ message: 'A valid new date is required' });
      }

      const appointment = await Appointment.findOne({ _id: req.params.id, patient: req.user.id });
      if (!appointment) {
         return res.status(404).json({ message: 'Appointment not found' });
      }
      if (appointment.status !== 'upcoming') {
         return res.status(400).json({ message: 'Only upcoming appointments can be rescheduled' });
      }

      appointment.date = new Date(date);
      await appointment.save();

      await notify({
         recipientId: appointment.doctor,
         recipientRole: 'doctor',
         type: 'appointment',
         title: 'Appointment Rescheduled',
         desc: `${appointment.patientName} rescheduled their ${appointment.type} consultation to a new time.`,
         meta: { appointmentId: appointment._id },
      });

      res.json(await appointment.populate('doctor', DOCTOR_FIELDS));
   } catch (err) {
      res.status(500).json({ message: 'Failed to reschedule appointment', error: err.message });
   }
};
