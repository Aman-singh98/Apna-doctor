// models/PendingPaymentOrder.js
//
// A Razorpay order is created BEFORE any Appointment exists (per Flow B) —
// the Appointment is only created after the payment signature is verified.
// That means there's nothing to dedupe order-creation retries against using
// the Appointment collection, so this short-lived record fills that gap:
//
//   - idempotencyKey: derived from (patient, doctor, type, familyMember) so
//     a retried create-order call (double-tap, network retry) for the same
//     in-flight booking attempt returns the SAME Razorpay order instead of
//     creating a new one every time.
//   - Also doubles as the authoritative source of the fee/split that was
//     computed server-side at order-creation time, so the extended
//     createAppointment endpoint never has to trust a client-sent amount —
//     it looks the amount back up from here by razorpayOrderId.
//   - TTL index auto-deletes these ~30 min after creation (Razorpay test/live
//     orders aren't valid to pay against indefinitely either), so this
//     collection never grows unbounded and doesn't need a cron job.
//
// NOT a replacement for Appointment — once payment is verified, the
// Appointment + Transaction become the permanent record; this row has
// already served its purpose by that point (kept until TTL expiry only for
// idempotent-retry coverage of the createAppointment call itself).

const mongoose = require('mongoose');

const pendingPaymentOrderSchema = new mongoose.Schema({
	idempotencyKey: { type: String, required: true, unique: true },

	razorpayOrderId: { type: String, required: true, unique: true, index: true },

	patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
	doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
	familyMember: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
	type: { type: String, enum: ['Video', 'Audio', 'Chat'], required: true },

	// The intended consultation slot, captured at order-creation time (the
	// patient picks a slot before hitting "Book & Pay" — see
	// ApnaDoctor-Mob book-appointment.js). Stored here — not just passed
	// straight through to createAppointment later — because Phase 4's
	// payment.captured webhook safety net (services/paymentWebhookService.js)
	// has to be able to create the SAME Appointment from this record alone
	// if the app never calls back after Checkout succeeds. Without this,
	// the webhook would have no way to know what slot was being booked.
	date: { type: Date, required: true },

	// Server-computed at order-creation time — never re-derived from client
	// input later. totalAmount = doctorAmount + platformAmount.
	totalAmount: { type: Number, required: true },
	doctorAmount: { type: Number, required: true },
	platformAmount: { type: Number, required: true },

	createdAt: { type: Date, default: Date.now, expires: 60 * 30 }, // TTL: 30 minutes
});

module.exports = mongoose.model('PendingPaymentOrder', pendingPaymentOrderSchema);
