// tests/razorpayService.test.js
//
// Task 16: "Write unit tests first for signature verification with
// known-good and tampered payloads before wiring up anything downstream."
// These specifically target the security boundary — Checkout signature and
// webhook signature verification — since that's where a bug is most
// dangerous (a false "verified" lets an attacker create a free booking or
// forge a webhook event).

process.env.RAZORPAY_KEY_ID = 'rzp_test_unittest';
process.env.RAZORPAY_KEY_SECRET = 'unit_test_key_secret_value';
process.env.RAZORPAY_WEBHOOK_SECRET = 'unit_test_webhook_secret_value';

const crypto = require('crypto');
const razorpayService = require('../services/razorpayService');

function signCheckout(orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) {
	return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function signWebhook(rawBody, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
	return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

describe('razorpayService.verifyPaymentSignature (Checkout signature)', () => {
	test('accepts a known-good signature', () => {
		const orderId = 'order_ABC123';
		const paymentId = 'pay_XYZ789';
		const signature = signCheckout(orderId, paymentId);

		expect(razorpayService.verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
	});

	test('rejects a tampered signature (single character flipped)', () => {
		const orderId = 'order_ABC123';
		const paymentId = 'pay_XYZ789';
		const signature = signCheckout(orderId, paymentId);
		const tampered = signature.slice(0, -1) + (signature.slice(-1) === 'a' ? 'b' : 'a');

		expect(razorpayService.verifyPaymentSignature({ orderId, paymentId, signature: tampered })).toBe(false);
	});

	test('rejects a signature computed for a different order/payment pair', () => {
		const signature = signCheckout('order_ABC123', 'pay_XYZ789');

		expect(
			razorpayService.verifyPaymentSignature({ orderId: 'order_DIFFERENT', paymentId: 'pay_XYZ789', signature })
		).toBe(false);
	});

	test('rejects a signature signed with the wrong secret (e.g. webhook secret used by mistake)', () => {
		const orderId = 'order_ABC123';
		const paymentId = 'pay_XYZ789';
		const signature = signCheckout(orderId, paymentId, process.env.RAZORPAY_WEBHOOK_SECRET);

		expect(razorpayService.verifyPaymentSignature({ orderId, paymentId, signature })).toBe(false);
	});

	test('rejects when signature is missing/empty', () => {
		expect(razorpayService.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: '' })).toBe(false);
		expect(razorpayService.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: undefined })).toBe(false);
	});

	test('rejects when orderId or paymentId is missing', () => {
		const signature = signCheckout('order_1', 'pay_1');
		expect(razorpayService.verifyPaymentSignature({ orderId: '', paymentId: 'pay_1', signature })).toBe(false);
		expect(razorpayService.verifyPaymentSignature({ orderId: 'order_1', paymentId: '', signature })).toBe(false);
	});

	test('rejects a signature of different length without throwing', () => {
		// crypto.timingSafeEqual throws on length mismatch if called directly
		// on unequal buffers — verifyPaymentSignature must guard against that
		// itself rather than letting the request 500.
		expect(() =>
			razorpayService.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'short' })
		).not.toThrow();
		expect(
			razorpayService.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'short' })
		).toBe(false);
	});
});

describe('razorpayService.verifyWebhookSignature', () => {
	test('accepts a known-good webhook signature', () => {
		const rawBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });
		const signature = signWebhook(rawBody);

		expect(razorpayService.verifyWebhookSignature({ rawBody, signature })).toBe(true);
	});

	test('rejects a tampered payload (body changed after signing)', () => {
		const originalBody = JSON.stringify({ event: 'payment.captured', amount: 39900 });
		const signature = signWebhook(originalBody);
		const tamperedBody = JSON.stringify({ event: 'payment.captured', amount: 999900 }); // attacker inflates amount

		expect(razorpayService.verifyWebhookSignature({ rawBody: tamperedBody, signature })).toBe(false);
	});

	test('rejects a signature signed with the Checkout Key Secret instead of the webhook secret', () => {
		const rawBody = JSON.stringify({ event: 'payment.captured' });
		const signature = signWebhook(rawBody, process.env.RAZORPAY_KEY_SECRET); // wrong secret on purpose

		expect(razorpayService.verifyWebhookSignature({ rawBody, signature })).toBe(false);
	});

	test('rejects when rawBody or signature is missing', () => {
		expect(razorpayService.verifyWebhookSignature({ rawBody: '', signature: 'abc' })).toBe(false);
		expect(razorpayService.verifyWebhookSignature({ rawBody: '{}', signature: '' })).toBe(false);
	});
});

describe('razorpayService.safeEqual', () => {
	test('is a true constant-time-safe equality check for equal strings', () => {
		expect(razorpayService.safeEqual('abc123', 'abc123')).toBe(true);
	});

	test('returns false (not throws) for differing lengths', () => {
		expect(() => razorpayService.safeEqual('short', 'a-much-longer-string')).not.toThrow();
		expect(razorpayService.safeEqual('short', 'a-much-longer-string')).toBe(false);
	});

	test('returns false for same-length but different content', () => {
		expect(razorpayService.safeEqual('aaaaaa', 'aaaaab')).toBe(false);
	});
});

describe('razorpayService.toPaise', () => {
	test('converts rupees to integer paise', () => {
		expect(razorpayService.toPaise(399)).toBe(39900);
		expect(razorpayService.toPaise(299.5)).toBe(29950);
	});

	test('rounds fractional-paise results from split math instead of truncating', () => {
		// 70% of ₹299 = ₹209.30 exactly, but percentages elsewhere can produce
		// e.g. ₹209.333... — toPaise must round, not floor, to avoid losing a
		// paise across many transactions.
		expect(razorpayService.toPaise(209.333)).toBe(20933);
	});
});

describe('razorpayService.createOrder input validation', () => {
	test('rejects a non-positive amount before ever calling the Razorpay API', async () => {
		await expect(razorpayService.createOrder({ amountInRupees: 0, receipt: 'r1' })).rejects.toThrow(
			/positive number/
		);
		await expect(razorpayService.createOrder({ amountInRupees: -50, receipt: 'r1' })).rejects.toThrow(
			/positive number/
		);
	});
});

describe('razorpayService.createRouteTransfer input validation', () => {
	test('rejects missing paymentId/doctorAccountId/amount before calling the API', async () => {
		await expect(
			razorpayService.createRouteTransfer({ paymentId: '', doctorAccountId: 'acc_1', amountInRupees: 100 })
		).rejects.toThrow(/paymentId/);
		await expect(
			razorpayService.createRouteTransfer({ paymentId: 'pay_1', doctorAccountId: '', amountInRupees: 100 })
		).rejects.toThrow(/doctorAccountId/);
		await expect(
			razorpayService.createRouteTransfer({ paymentId: 'pay_1', doctorAccountId: 'acc_1', amountInRupees: 0 })
		).rejects.toThrow(/positive number/);
	});
});
