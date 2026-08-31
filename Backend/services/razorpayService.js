// services/razorpayService.js
//
// Every call to the Razorpay SDK goes through here — nothing elsewhere in the
// codebase should `require('razorpay')` directly. Centralizing it means:
//   - the Key Secret / Webhook Secret are read from env in exactly one place
//   - signature verification is implemented once, correctly (constant-time),
//     instead of being re-implemented (and possibly re-broken) per call site
//   - amounts are always converted rupees → paise here, in one place, so a
//     missed *100 can't silently under/over-charge somewhere else
//
// SECURITY: signature verification is the security boundary between "someone
// paid" and "we believe someone paid." Every function here that checks a
// signature uses crypto.timingSafeEqual, never `===` on raw strings — a
// naive string comparison leaks timing information that can be used to
// forge a valid signature byte-by-byte.

const crypto = require('crypto');
const Razorpay = require('razorpay');

const CURRENCY = 'INR';

let _instance = null;

// Lazy singleton — avoids crashing at require-time (e.g. during tests or
// `node -e` sanity checks) if env vars aren't loaded yet, but still only
// constructs one SDK client per process.
function getInstance() {
	if (_instance) return _instance;

	const key_id = process.env.RAZORPAY_KEY_ID;
	const key_secret = process.env.RAZORPAY_KEY_SECRET;

	if (!key_id || !key_secret) {
		throw new Error(
			'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. Add them to Backend/.env (see .env.example).'
		);
	}

	_instance = new Razorpay({ key_id, key_secret });
	return _instance;
}

// Rupees (can be fractional, e.g. from a % split) → integer paise, the unit
// Razorpay's API expects everywhere. Round rather than truncate so split
// math (doctor % + platform % of the same fee) doesn't lose a paise.
function toPaise(amountInRupees) {
	return Math.round(amountInRupees * 100);
}

/**
 * Constant-time comparison of two hex/base64-ish strings. Returns false
 * (never throws) on length mismatch instead of letting
 * crypto.timingSafeEqual reject — a plain length check leaks only that
 * lengths differ, not any byte of the secret-derived digest, which is the
 * property we actually need.
 */
function safeEqual(a, b) {
	const bufA = Buffer.from(String(a || ''), 'utf8');
	const bufB = Buffer.from(String(b || ''), 'utf8');
	if (bufA.length !== bufB.length) return false;
	return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create a Razorpay order. Caller must have already computed `amountInRupees`
 * server-side (e.g. from doctorFeeConfig.js) — this function does not, and
 * must not, accept a client-supplied amount without the caller having
 * validated it against the fee config first.
 *
 * @param {Object} params
 * @param {Number} params.amountInRupees
 * @param {String} params.receipt - your own reference id, <= 40 chars
 * @param {Object} [params.notes]
 */
async function createOrder({ amountInRupees, receipt, notes = {} }) {
	if (typeof amountInRupees !== 'number' || !(amountInRupees > 0)) {
		throw new Error('createOrder: amountInRupees must be a positive number');
	}
	const instance = getInstance();
	return instance.orders.create({
		amount: toPaise(amountInRupees),
		currency: CURRENCY,
		receipt,
		notes,
		payment_capture: 1, // auto-capture — we don't want a manual capture step in this flow
	});
}

/**
 * Verify a Razorpay Checkout signature (the one returned to the client after
 * a successful payment, per Razorpay's docs: HMAC-SHA256 of
 * `${order_id}|${payment_id}` using the Key Secret).
 *
 * @returns {Boolean}
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
	if (!orderId || !paymentId || !signature) return false;
	const key_secret = process.env.RAZORPAY_KEY_SECRET;
	if (!key_secret) {
		throw new Error('RAZORPAY_KEY_SECRET is not set.');
	}
	const expected = crypto
		.createHmac('sha256', key_secret)
		.update(`${orderId}|${paymentId}`)
		.digest('hex');
	return safeEqual(expected, signature);
}

/**
 * Verify a Razorpay webhook signature. IMPORTANT: this uses the WEBHOOK
 * secret, which is a different value from the Checkout Key Secret above —
 * never pass RAZORPAY_KEY_SECRET in here. `rawBody` must be the exact raw
 * request body bytes/string Razorpay signed, not a re-serialized JSON.parse
 * → JSON.stringify round-trip (which is not guaranteed to be byte-identical
 * and would break verification). See Phase 4 for wiring the raw-body
 * middleware this depends on.
 *
 * @returns {Boolean}
 */
function verifyWebhookSignature({ rawBody, signature }) {
	if (!rawBody || !signature) return false;
	const webhook_secret = process.env.RAZORPAY_WEBHOOK_SECRET;
	if (!webhook_secret) {
		throw new Error('RAZORPAY_WEBHOOK_SECRET is not set.');
	}
	const expected = crypto.createHmac('sha256', webhook_secret).update(rawBody).digest('hex');
	return safeEqual(expected, signature);
}

/**
 * Create a Route transfer of the doctor's share out of an already-captured
 * payment, held (on_hold) until the consultation completes.
 *
 * @param {Object} params
 * @param {String} params.paymentId - the captured Razorpay payment id
 * @param {String} params.doctorAccountId - doctor's Route linked account id
 * @param {Number} params.amountInRupees - doctor's share only, not the full fee
 * @param {Boolean} [params.onHold=true]
 * @param {Object} [params.notes]
 */
async function createRouteTransfer({ paymentId, doctorAccountId, amountInRupees, onHold = true, notes = {} }) {
	if (!paymentId) throw new Error('createRouteTransfer: paymentId is required');
	if (!doctorAccountId) throw new Error('createRouteTransfer: doctorAccountId is required');
	if (typeof amountInRupees !== 'number' || !(amountInRupees > 0)) {
		throw new Error('createRouteTransfer: amountInRupees must be a positive number');
	}
	const instance = getInstance();
	const result = await instance.payments.transfer(paymentId, {
		transfers: [
			{
				account: doctorAccountId,
				amount: toPaise(amountInRupees),
				currency: CURRENCY,
				on_hold: onHold ? 1 : 0,
				notes,
			},
		],
	});
	// Razorpay returns { items: [...] } for this endpoint — normalize to the
	// single transfer object callers care about.
	return Array.isArray(result?.items) ? result.items[0] : result;
}

/**
 * Release a previously held Route transfer so it settles on Razorpay's
 * normal settlement cycle. Called on consultation completion (Phase 5).
 */
async function releaseTransfer(transferId) {
	if (!transferId) throw new Error('releaseTransfer: transferId is required');
	const instance = getInstance();
	return instance.transfers.edit(transferId, { on_hold: 0 });
}

/**
 * Void/hold a transfer back (used defensively — normally a refund
 * auto-voids the linked transfer, but Phase 6 must verify that in test mode
 * rather than assume it, per the task doc).
 */
async function holdTransfer(transferId) {
	if (!transferId) throw new Error('holdTransfer: transferId is required');
	const instance = getInstance();
	return instance.transfers.edit(transferId, { on_hold: 1 });
}

/**
 * Issue a refund for a captured payment. Omit `amountInRupees` for a full
 * refund; pass it for a partial refund (not currently used by any flow, but
 * supported since the SDK supports it).
 */
async function issueRefund({ paymentId, amountInRupees, notes = {} }) {
	if (!paymentId) throw new Error('issueRefund: paymentId is required');
	const instance = getInstance();
	const params = { notes };
	if (typeof amountInRupees === 'number') {
		params.amount = toPaise(amountInRupees);
	}
	return instance.payments.refund(paymentId, params);
}

// ─────────────────────────────────────────────────────────────────────────
// Route account onboarding (Phase 3, task 17) — three Razorpay API calls to
// take a doctor from "approved in our system" to "has a Route linked
// account that can receive transfers":
//   1. accounts.create        — business/contact identity
//   2. stakeholders.create    — the individual's KYC identity (PAN)
//   3. products.requestProductConfiguration — requests the "route" product
//      and supplies the settlement destination (bank account or UPI VPA)
//
// All three are called from services/doctorPayoutService.js, never
// directly from a controller — same "one place wraps the SDK" rule as the
// rest of this file. Field names here follow Razorpay's Route Account
// Onboarding API (v2); re-verify against current Razorpay docs before
// going live, since partner/route API shapes do change between doc
// revisions.
//
// SECURITY: none of these functions may log their `params` — PAN, bank
// account number, and UPI ID pass through here in plaintext (decrypted
// just-in-time by the caller). Logging is the caller's job, and the caller
// must only log correlation ids (doctorId, accountId), never these values.

/**
 * Step 1 — create the Route linked account (business + contact identity,
 * PAN). Does not accept bank/UPI details — those go in step 3.
 *
 * @param {Object} params
 * @param {String} params.email
 * @param {String} params.phone
 * @param {String} params.legalBusinessName
 * @param {String} params.businessType - e.g. 'individual', 'proprietorship'
 * @param {String} params.contactName
 * @param {String} [params.pan]
 */
async function createLinkedAccount({ email, phone, legalBusinessName, businessType, contactName, pan }) {
	if (!email) throw new Error('createLinkedAccount: email is required');
	if (!phone) throw new Error('createLinkedAccount: phone is required');
	if (!legalBusinessName) throw new Error('createLinkedAccount: legalBusinessName is required');
	if (!businessType) throw new Error('createLinkedAccount: businessType is required');
	if (!contactName) throw new Error('createLinkedAccount: contactName is required');

	const instance = getInstance();
	return instance.accounts.create({
		email,
		phone,
		type: 'standard',
		legal_business_name: legalBusinessName,
		business_type: businessType,
		contact_name: contactName,
		profile: {
			category: 'healthcare',
			subcategory: 'doctor',
			business_model: 'Telemedicine consultation fees collected on behalf of an independent doctor.',
		},
		...(pan ? { legal_info: { pan } } : {}),
	});
}

/**
 * Step 2 — create the stakeholder (the doctor as an individual) under the
 * linked account, carrying their personal KYC identity.
 *
 * @param {String} accountId - id returned by createLinkedAccount
 * @param {Object} params
 * @param {String} params.name
 * @param {String} params.email
 * @param {String} [params.pan]
 */
async function createStakeholder(accountId, { name, email, pan }) {
	if (!accountId) throw new Error('createStakeholder: accountId is required');
	if (!name) throw new Error('createStakeholder: name is required');
	if (!email) throw new Error('createStakeholder: email is required');

	const instance = getInstance();
	return instance.stakeholders.create(accountId, {
		name,
		email,
		...(pan ? { kyc: { pan } } : {}),
	});
}

/**
 * Step 3 — request the "route" product configuration on the linked account
 * and supply where the doctor's share should settle: a bank account (IFSC
 * + account number) or a UPI VPA. Exactly one of bankAccount/vpa should be
 * provided; bank account takes precedence if both are given.
 *
 * @param {String} accountId
 * @param {Object} params
 * @param {String} [params.tncAcceptedIp] - required by Razorpay alongside tnc_accepted
 * @param {Object} [params.bankAccount] - { accountNumber, ifscCode, beneficiaryName }
 * @param {String} [params.vpa]
 */
async function requestRouteProductConfig(accountId, { tncAcceptedIp, bankAccount, vpa }) {
	if (!accountId) throw new Error('requestRouteProductConfig: accountId is required');
	if (!bankAccount && !vpa) {
		throw new Error('requestRouteProductConfig: either bankAccount or vpa is required');
	}

	const settlements = bankAccount
		? {
				account_number: bankAccount.accountNumber,
				ifsc_code: bankAccount.ifscCode,
				beneficiary_name: bankAccount.beneficiaryName,
			}
		: { vpa };

	const instance = getInstance();
	return instance.products.requestProductConfiguration(accountId, {
		product_name: 'route',
		tnc_accepted: true,
		...(tncAcceptedIp ? { ip: tncAcceptedIp } : {}),
		settlements,
	});
}

module.exports = {
	CURRENCY,
	toPaise,
	safeEqual,
	createOrder,
	verifyPaymentSignature,
	verifyWebhookSignature,
	createRouteTransfer,
	releaseTransfer,
	holdTransfer,
	issueRefund,
	createLinkedAccount,
	createStakeholder,
	requestRouteProductConfig,
};
