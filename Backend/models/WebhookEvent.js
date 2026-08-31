// models/WebhookEvent.js
//
// Idempotency ledger for inbound Razorpay webhooks. Razorpay retries
// webhook delivery on anything other than a 2xx response, and can also
// legitimately deliver the same event twice (documented behavior) — so
// every webhook handler must dedupe by Razorpay's event id before acting.
//
// This collection is deliberately generic (not KYC-account-specific) so
// Phase 4's payment.captured / payment.failed / transfer.processed
// handlers can reuse the exact same dedupe-and-record pattern established
// here for account.* events (Phase 3, task 20) rather than each endpoint
// inventing its own idempotency mechanism.
//
// Dedupe strategy: `razorpayEventId` has a unique index. A handler calls
// markProcessed() FIRST — if it throws a duplicate-key error, the event
// was already handled and the handler should no-op and return 200 (so
// Razorpay stops retrying) without re-applying side effects. This must
// happen before any state-changing work, not after, or two concurrent
// deliveries of the same event can both pass a "have I seen this?" read
// check and then both apply the side effect.
//
// TTL: kept for 90 days — long enough to dedupe Razorpay's retry window
// and to support tracing a support ticket back through webhook history,
// short enough that this collection doesn't grow unbounded.

const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
	razorpayEventId: { type: String, required: true, unique: true, index: true },

	// e.g. 'account.activated', 'payment.captured' — not constrained to an
	// enum since Razorpay's event catalog is broader than any one handler.
	eventType: { type: String, required: true, index: true },

	// Non-sensitive correlation id extracted from the payload for tracing
	// (accountId / paymentId / orderId, whichever applies) — never the raw
	// payload itself, which may carry PII (bank/UPI/PAN fields on account
	// events) that shouldn't be duplicated into a second collection.
	relatedId: { type: String },

	receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 }, // TTL: 90 days
});

/**
 * Atomically claim an event id. Returns true if this call claimed it
 * (i.e. first delivery — caller should process it), false if it was
 * already claimed (duplicate delivery — caller should no-op).
 * Never throws on the expected duplicate-key case.
 */
webhookEventSchema.statics.claim = async function claim({ razorpayEventId, eventType, relatedId }) {
	try {
		await this.create({ razorpayEventId, eventType, relatedId });
		return true;
	} catch (err) {
		if (err && err.code === 11000) return false; // duplicate key — already processed
		throw err;
	}
};

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
