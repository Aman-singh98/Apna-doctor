// tests/webhookController.test.js
//
// Phase 3, task 20: the webhook endpoint that flips Doctor.payoutStatus to
// 'active' once Razorpay confirms Route account KYC. Covers the security
// boundary (signature verification, must happen before anything else),
// idempotency (duplicate event id must not re-run the handler), replay
// protection (stale created_at rejected), and the happy path dispatch to
// doctorPayoutService.
//
// Mongoose/WebhookEvent and doctorPayoutService are mocked so this only
// exercises webhookController's own request-handling logic — no DB.

process.env.RAZORPAY_KEY_ID = 'rzp_test_unittest';
process.env.RAZORPAY_KEY_SECRET = 'unit_test_key_secret_value';
process.env.RAZORPAY_WEBHOOK_SECRET = 'unit_test_webhook_secret_value';

jest.mock('../models/WebhookEvent');
jest.mock('../services/doctorPayoutService', () => ({
	handleAccountWebhookEvent: jest.fn().mockResolvedValue({ handled: true, doctorId: 'doc_1', payoutStatus: 'active' }),
}));
jest.mock('../services/paymentWebhookService', () => ({
	handlePaymentCapturedEvent: jest.fn().mockResolvedValue({ handled: true, created: true, appointmentId: 'appt_1' }),
	handlePaymentFailedEvent: jest.fn().mockResolvedValue({ handled: true }),
	handleTransferProcessedEvent: jest.fn().mockResolvedValue({ handled: true, changed: true, transactionId: 'txn_1' }),
}));
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const crypto = require('crypto');
const WebhookEvent = require('../models/WebhookEvent');
const { handleAccountWebhookEvent } = require('../services/doctorPayoutService');
const {
	handlePaymentCapturedEvent,
	handlePaymentFailedEvent,
	handleTransferProcessedEvent,
} = require('../services/paymentWebhookService');
const { logSecurityEvent } = require('../utils/paymentLogger');
const { handleRazorpayWebhook } = require('../controllers/webhookController');

function signWebhook(rawBody, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
	return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function makeAccountActivatedPayload({ eventId = 'evt_1', accountId = 'acc_123', createdAt } = {}) {
	const body = {
		id: eventId,
		event: 'account.activated',
		created_at: createdAt !== undefined ? createdAt : Math.floor(Date.now() / 1000),
		payload: { account: { entity: { id: accountId, status: 'activated' } } },
	};
	return Buffer.from(JSON.stringify(body), 'utf8');
}

function makeReqRes(rawBody, signature) {
	const req = {
		body: rawBody,
		headers: { 'x-razorpay-signature': signature },
		originalUrl: '/api/webhooks/razorpay',
	};
	const res = {
		statusCode: null,
		jsonBody: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(body) {
			this.jsonBody = body;
			return this;
		},
	};
	return { req, res };
}

beforeEach(() => {
	jest.clearAllMocks();
	WebhookEvent.claim.mockResolvedValue(true); // default: first delivery
});

describe('handleRazorpayWebhook — signature verification', () => {
	test('rejects a tampered signature with 400 and never calls the handler', async () => {
		const rawBody = makeAccountActivatedPayload();
		const tampered = signWebhook(rawBody).slice(0, -1) + 'x';
		const { req, res } = makeReqRes(rawBody, tampered);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(400);
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
		expect(logSecurityEvent).toHaveBeenCalledWith('webhook.signature_verification_failed', expect.any(Object), expect.any(Object));
	});

	test('rejects a missing signature with 400', async () => {
		const rawBody = makeAccountActivatedPayload();
		const { req, res } = makeReqRes(rawBody, undefined);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(400);
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
	});

	test('fails closed (500) if the body was already parsed instead of raw', async () => {
		const rawBody = makeAccountActivatedPayload();
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);
		req.body = JSON.parse(rawBody.toString('utf8')); // simulate a wrongly-applied json() parser

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(500);
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
	});

	test('accepts a known-good signature and processes the event', async () => {
		const rawBody = makeAccountActivatedPayload();
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handleAccountWebhookEvent).toHaveBeenCalledWith({ eventType: 'account.activated', razorpayAccountId: 'acc_123' });
	});
});

describe('handleRazorpayWebhook — idempotency', () => {
	test('a duplicate event id is not re-processed', async () => {
		const rawBody = makeAccountActivatedPayload({ eventId: 'evt_dup' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);
		WebhookEvent.claim.mockResolvedValueOnce(false); // already seen

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
	});

	test('claims the event before invoking the handler', async () => {
		const rawBody = makeAccountActivatedPayload({ eventId: 'evt_2', accountId: 'acc_456' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(WebhookEvent.claim).toHaveBeenCalledWith({
			razorpayEventId: 'evt_2',
			eventType: 'account.activated',
			relatedId: 'acc_456',
		});
	});
});

describe('handleRazorpayWebhook — replay protection', () => {
	test('rejects an event older than the max age window', async () => {
		const staleTimestamp = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 3; // 3 days old
		const rawBody = makeAccountActivatedPayload({ eventId: 'evt_stale', createdAt: staleTimestamp });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(400);
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
		expect(WebhookEvent.claim).not.toHaveBeenCalled();
	});
});

describe('handleRazorpayWebhook — malformed payloads', () => {
	test('rejects a body that is not valid JSON', async () => {
		const rawBody = Buffer.from('not json', 'utf8');
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(400);
	});

	test('rejects a payload missing event/id fields', async () => {
		const rawBody = Buffer.from(JSON.stringify({ payload: {} }), 'utf8');
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(400);
	});
});

describe('handleRazorpayWebhook — non-account event types', () => {
	test('an event type with no handler is acknowledged (200) without dispatching to any handler', async () => {
		const body = {
			id: 'evt_other',
			event: 'payment.authorized', // not yet handled by any branch
			created_at: Math.floor(Date.now() / 1000),
			payload: {},
		};
		const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
		expect(handlePaymentCapturedEvent).not.toHaveBeenCalled();
	});
});

describe('handleRazorpayWebhook — payment.captured (Phase 4, task 22)', () => {
	function makePaymentCapturedPayload({ eventId = 'evt_pay_1', orderId = 'order_abc', paymentId = 'pay_abc', createdAt, notes = {} } = {}) {
		const body = {
			id: eventId,
			event: 'payment.captured',
			created_at: createdAt !== undefined ? createdAt : Math.floor(Date.now() / 1000),
			payload: {
				payment: {
					entity: {
						id: paymentId,
						order_id: orderId,
						amount: 39900,
						currency: 'INR',
						status: 'captured',
						notes,
					},
				},
			},
		};
		return Buffer.from(JSON.stringify(body), 'utf8');
	}

	test('dispatches to paymentWebhookService with the payment entity', async () => {
		const rawBody = makePaymentCapturedPayload({ orderId: 'order_xyz', paymentId: 'pay_xyz' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handlePaymentCapturedEvent).toHaveBeenCalledWith({
			paymentEntity: expect.objectContaining({ id: 'pay_xyz', order_id: 'order_xyz' }),
		});
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
	});

	test('still acknowledges (200) even when the service reports it could not safely handle the event', async () => {
		handlePaymentCapturedEvent.mockResolvedValueOnce({ handled: false, created: false });
		const rawBody = makePaymentCapturedPayload({ eventId: 'evt_pay_unrecoverable' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		// A 200 is still correct here: this stops Razorpay retrying an event
		// this handler has already determined it cannot safely act on (see
		// paymentWebhookService's own logging for the "why") — retries can't
		// fix a missing PendingPaymentOrder/notes.
		expect(res.statusCode).toBe(200);
	});

	test('a duplicate delivery of the same payment.captured event is not re-processed', async () => {
		const rawBody = makePaymentCapturedPayload({ eventId: 'evt_pay_dup' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);
		WebhookEvent.claim.mockResolvedValueOnce(false); // already seen

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handlePaymentCapturedEvent).not.toHaveBeenCalled();
	});

	test('a handler error is logged as a security event but still returns 200', async () => {
		handlePaymentCapturedEvent.mockRejectedValueOnce(new Error('DB unavailable'));
		const rawBody = makePaymentCapturedPayload({ eventId: 'evt_pay_error' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'webhook.handler_error',
			expect.objectContaining({ eventId: 'evt_pay_error' }),
			expect.objectContaining({ eventType: 'payment.captured' })
		);
	});
});

describe('handleRazorpayWebhook — payment.failed (Phase 4, task 23)', () => {
	function makePaymentFailedPayload({ eventId = 'evt_fail_1', orderId = 'order_fail', paymentId = 'pay_fail' } = {}) {
		const body = {
			id: eventId,
			event: 'payment.failed',
			created_at: Math.floor(Date.now() / 1000),
			payload: {
				payment: {
					entity: {
						id: paymentId,
						order_id: orderId,
						error_code: 'BAD_REQUEST_ERROR',
						error_description: 'Payment failed',
					},
				},
			},
		};
		return Buffer.from(JSON.stringify(body), 'utf8');
	}

	test('dispatches to paymentWebhookService with the payment entity', async () => {
		const rawBody = makePaymentFailedPayload({ orderId: 'order_xyz', paymentId: 'pay_xyz' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handlePaymentFailedEvent).toHaveBeenCalledWith({
			paymentEntity: expect.objectContaining({ id: 'pay_xyz', order_id: 'order_xyz' }),
		});
		expect(handlePaymentCapturedEvent).not.toHaveBeenCalled();
		expect(handleAccountWebhookEvent).not.toHaveBeenCalled();
	});

	test('claims the event by payment id for dedupe correlation', async () => {
		const rawBody = makePaymentFailedPayload({ eventId: 'evt_fail_2', paymentId: 'pay_dedupe' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(WebhookEvent.claim).toHaveBeenCalledWith(
			expect.objectContaining({ razorpayEventId: 'evt_fail_2', eventType: 'payment.failed', relatedId: 'pay_dedupe' })
		);
	});

	test('a duplicate delivery is not re-processed', async () => {
		const rawBody = makePaymentFailedPayload({ eventId: 'evt_fail_dup' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);
		WebhookEvent.claim.mockResolvedValueOnce(false);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handlePaymentFailedEvent).not.toHaveBeenCalled();
	});
});

describe('handleRazorpayWebhook — transfer.processed (Phase 4, task 24)', () => {
	function makeTransferProcessedPayload({ eventId = 'evt_trf_1', transferId = 'trf_abc', onHold = false } = {}) {
		const body = {
			id: eventId,
			event: 'transfer.processed',
			created_at: Math.floor(Date.now() / 1000),
			payload: {
				transfer: {
					entity: {
						id: transferId,
						source: 'pay_abc',
						recipient: 'acc_abc',
						status: 'processed',
						on_hold: onHold,
					},
				},
			},
		};
		return Buffer.from(JSON.stringify(body), 'utf8');
	}

	test('dispatches to paymentWebhookService with the transfer entity', async () => {
		const rawBody = makeTransferProcessedPayload({ transferId: 'trf_xyz' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handleTransferProcessedEvent).toHaveBeenCalledWith({
			transferEntity: expect.objectContaining({ id: 'trf_xyz' }),
		});
	});

	test('claims the event by transfer id for dedupe correlation', async () => {
		const rawBody = makeTransferProcessedPayload({ eventId: 'evt_trf_2', transferId: 'trf_dedupe' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);

		await handleRazorpayWebhook(req, res);

		expect(WebhookEvent.claim).toHaveBeenCalledWith(
			expect.objectContaining({ razorpayEventId: 'evt_trf_2', eventType: 'transfer.processed', relatedId: 'trf_dedupe' })
		);
	});

	test('a duplicate delivery is not re-processed', async () => {
		const rawBody = makeTransferProcessedPayload({ eventId: 'evt_trf_dup' });
		const signature = signWebhook(rawBody);
		const { req, res } = makeReqRes(rawBody, signature);
		WebhookEvent.claim.mockResolvedValueOnce(false);

		await handleRazorpayWebhook(req, res);

		expect(res.statusCode).toBe(200);
		expect(handleTransferProcessedEvent).not.toHaveBeenCalled();
	});
});
