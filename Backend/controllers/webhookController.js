// controllers/webhookController.js
//
// POST /api/webhooks/razorpay
//
// Phase 3, task 20: handles the `account.*` family of events so a doctor's
// async Route KYC confirmation flips payoutStatus to `active` without an
// admin having to poll Razorpay.
// Phase 4: also handles `payment.captured` (task 22 — safety net, creates
// the Appointment if the app-driven confirmation call never arrived),
// `payment.failed` (task 23 — cleanup + logging, no Appointment involved),
// and `transfer.processed` (task 24 — mirrors settlement state onto
// Transaction). See services/paymentWebhookService.js for all three.
// Any other event type falls through to the generic log-and-acknowledge
// branch below so registering it in the Razorpay dashboard ahead of the
// code that handles it doesn't cause failures/retries. The signature
// verification, raw-body handling, and event-dedupe below are shared by
// every event type.
//
// SECURITY (non-negotiable, per the project's engineering standards):
//   1. Verify the signature BEFORE parsing/trusting the payload. This
//      handler receives `req.body` as a raw Buffer (see routes/webhookRoutes.js
//      + server.js, which mount `express.raw()` for this path specifically,
//      ahead of the global `express.json()`) so the exact bytes Razorpay
//      signed are what gets verified — a JSON.parse → JSON.stringify
//      round-trip is not guaranteed byte-identical and would break this.
//   2. Use the WEBHOOK secret, never the Checkout Key Secret — enforced by
//      razorpayService.verifyWebhookSignature itself reading
//      RAZORPAY_WEBHOOK_SECRET, but called out here too since mixing the
//      two secrets up is exactly the kind of bug this endpoint can't have.
//   3. Dedupe by Razorpay's event id BEFORE running any handler, so a
//      retried/duplicate delivery can never double-apply a side effect.
//   4. Always respond 200 for a well-formed, correctly-signed event even if
//      we didn't act on it (unrecognized account, event type we don't
//      handle) — only signature failures and malformed requests get a
//      non-2xx, since a 200 is what stops Razorpay from retrying forever.

const razorpayService = require('../services/razorpayService');
const WebhookEvent = require('../models/WebhookEvent');
const { handleAccountWebhookEvent } = require('../services/doctorPayoutService');
const { handlePaymentCapturedEvent, handlePaymentFailedEvent, handleTransferProcessedEvent } = require('../services/paymentWebhookService');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');

// Reject events whose `created_at` is further in the past than this from
// when we received them — basic replay protection per the engineering
// standards doc ("reject anything ... including replay beyond a
// reasonable timestamp window"). Razorpay's own retry window is measured
// in hours/days, but a *fresh* delivery should always be recent; a signed
// payload replayed long after the fact is suspicious even if the
// signature itself still checks out (e.g. a leaked/logged payload).
const MAX_EVENT_AGE_SECONDS = 60 * 60 * 24; // 24h

async function handleRazorpayWebhook(req, res) {
	// express.raw() gives us a Buffer here, not a parsed object — required
	// for signature verification (see file header). If some other
	// middleware ran first and this isn't a Buffer, fail closed rather than
	// silently verifying against the wrong bytes.
	const rawBody = req.body;
	const signature = req.headers['x-razorpay-signature'];

	if (!Buffer.isBuffer(rawBody)) {
		logSecurityEvent('webhook.raw_body_missing', {}, { path: req.originalUrl });
		return res.status(500).json({ success: false, message: 'Webhook processing error.' });
	}

	let signatureValid = false;
	try {
		signatureValid = razorpayService.verifyWebhookSignature({ rawBody, signature });
	} catch (err) {
		// Missing RAZORPAY_WEBHOOK_SECRET etc. — a config error, not a client
		// error, but still must not proceed past this point.
		logSecurityEvent('webhook.verification_error', {}, { message: err.message });
		return res.status(500).json({ success: false, message: 'Webhook processing error.' });
	}

	if (!signatureValid) {
		// Generic response; the real reason is logged server-side only, same
		// rule as Flow F for Checkout failures — no signal to a caller
		// probing this endpoint about what would make it succeed.
		logSecurityEvent('webhook.signature_verification_failed', {}, { path: req.originalUrl });
		return res.status(400).json({ success: false, message: 'Invalid signature.' });
	}

	// Only parse/trust the payload after the signature above has verified
	// these exact bytes came from Razorpay.
	let event;
	try {
		event = JSON.parse(rawBody.toString('utf8'));
	} catch (err) {
		logSecurityEvent('webhook.malformed_payload', {}, { message: err.message });
		return res.status(400).json({ success: false, message: 'Malformed payload.' });
	}

	const eventType = event && event.event;
	const eventId = event && (event.id || req.headers['x-razorpay-event-id']);
	const createdAt = event && event.created_at; // Razorpay sends this as unix seconds

	if (!eventType || !eventId) {
		logSecurityEvent('webhook.missing_event_metadata', {}, { hasEventType: Boolean(eventType), hasEventId: Boolean(eventId) });
		return res.status(400).json({ success: false, message: 'Malformed payload.' });
	}

	if (typeof createdAt === 'number') {
		const ageSeconds = Math.floor(Date.now() / 1000) - createdAt;
		if (ageSeconds > MAX_EVENT_AGE_SECONDS) {
			logSecurityEvent('webhook.stale_event_rejected', { eventId }, { eventType, ageSeconds });
			return res.status(400).json({ success: false, message: 'Event too old to process.' });
		}
	}

	// Best-effort correlation id for the dedupe record, used only for
	// tracing — never anything from payoutKyc/PII fields. Whichever entity
	// this event type carries (account/payment/transfer), pull its id if
	// present.
	const accountId = event?.payload?.account?.entity?.id || event?.account_id || null;
	const paymentIdForDedupe = event?.payload?.payment?.entity?.id || null;
	const transferIdForDedupe = event?.payload?.transfer?.entity?.id || null;
	const relatedId = accountId || paymentIdForDedupe || transferIdForDedupe || null;

	const isFirstDelivery = await WebhookEvent.claim({ razorpayEventId: eventId, eventType, relatedId });
	if (!isFirstDelivery) {
		logEvent('webhook.duplicate_ignored', { eventId }, { eventType });
		return res.status(200).json({ success: true, message: 'Already processed.' });
	}

	logEvent('webhook.received', { eventId }, { eventType });

	try {
		if (eventType.startsWith('account.')) {
			await handleAccountWebhookEvent({ eventType, razorpayAccountId: accountId });
		} else if (eventType === 'payment.captured') {
			// Phase 4, task 22 — safety net: create the Appointment from the
			// webhook payload if the app-driven confirmation call never
			// arrived (see services/paymentWebhookService.js for the full
			// rationale). This never throws for "couldn't safely reconstruct
			// it" cases — those return handled:false and are logged inside
			// the service itself as security events for Phase 9 admin
			// reconciliation to pick up.
			const paymentEntity = event?.payload?.payment?.entity;
			await handlePaymentCapturedEvent({ paymentEntity });
		} else if (eventType === 'payment.failed') {
			// Phase 4, task 23 — no Appointment was ever created for a failed
			// payment (Flow F); this only cleans up the dead
			// PendingPaymentOrder and logs for traceability.
			const paymentEntity = event?.payload?.payment?.entity;
			await handlePaymentFailedEvent({ paymentEntity });
		} else if (eventType === 'transfer.processed') {
			// Phase 4, task 24 — mirror the transfer's settled/on_hold state
			// onto the matching Transaction.
			const transferEntity = event?.payload?.transfer?.entity;
			await handleTransferProcessedEvent({ transferEntity });
		} else {
			// Any other event type. Log rather than error so registering
			// additional event types in the Razorpay dashboard ahead of the
			// code that handles them doesn't cause failures/retries.
			logEvent('webhook.unhandled_event_type', { eventId }, { eventType });
		}
	} catch (err) {
		// The event is already claimed (dedupe record written) — if we
		// return non-200 here, Razorpay will retry, but WebhookEvent.claim
		// will report it as already-seen and this handler branch is skipped
		// on retry too, silently dropping a real processing failure. Log
		// loudly so monitoring/alerting (per the engineering standards doc)
		// can catch it; still return 200 since retries can't self-heal a
		// bug in our handler anyway.
		logSecurityEvent('webhook.handler_error', { eventId }, { eventType, message: err.message });
	}

	return res.status(200).json({ success: true });
}

module.exports = { handleRazorpayWebhook };
