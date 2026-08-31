// tests/doctorPayoutService.test.js
//
// Phase 3, tasks 17-18: orchestration logic for creating a doctor's
// Razorpay Route linked account — idempotency (don't double-create),
// refusing to proceed without KYC, storing the returned razorpayAccountId
// + payoutStatus on success, and leaving state untouched (with a security
// log, not a crash) on Razorpay failure.
//
// Doctor model and razorpayService are both mocked so these tests exercise
// only doctorPayoutService's own decision logic, not a real DB or network
// call.

process.env.PAYOUT_KYC_ENCRYPTION_KEY = 'b'.repeat(64);

jest.mock('../models/Doctor');
jest.mock('../services/razorpayService');
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Doctor = require('../models/Doctor');
const razorpayService = require('../services/razorpayService');
const { logSecurityEvent } = require('../utils/paymentLogger');
const { logEvent } = require('../utils/paymentLogger');
const { provisionPayoutAccount, PayoutProvisioningError, handleAccountWebhookEvent } = require('../services/doctorPayoutService');

function makeDoctorDoc(overrides = {}) {
	return {
		_id: 'doc_1',
		phone: '9999999999',
		name: 'Dr. Jane Doe',
		razorpayAccountId: null,
		payoutStatus: 'not_started',
		hasSubmittedPayoutKyc: jest.fn().mockReturnValue(true),
		getDecryptedPayoutKyc: jest.fn().mockReturnValue({
			pan: 'ABCDE1234F',
			bankAccountNumber: '123456789012',
			ifscCode: 'HDFC0001234',
			upiId: null,
			legalBusinessName: 'Dr. Jane Doe',
			businessType: 'individual',
			contactEmail: 'jane@example.com',
		}),
		save: jest.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe('provisionPayoutAccount', () => {
	test('throws DOCTOR_NOT_FOUND when the doctor does not exist', async () => {
		Doctor.findByIdWithPayoutKyc = jest.fn().mockResolvedValue(null);

		await expect(provisionPayoutAccount('missing_id')).rejects.toMatchObject({
			code: 'DOCTOR_NOT_FOUND',
		});
	});

	test('is a no-op returning already_active when payoutStatus is already active', async () => {
		const doc = makeDoctorDoc({ payoutStatus: 'active', razorpayAccountId: 'acc_existing' });
		Doctor.findByIdWithPayoutKyc = jest.fn().mockResolvedValue(doc);

		const result = await provisionPayoutAccount('doc_1');

		expect(result).toEqual({ status: 'already_active', payoutStatus: 'active', razorpayAccountId: 'acc_existing' });
		expect(razorpayService.createLinkedAccount).not.toHaveBeenCalled();
	});

	test('is a no-op returning already_pending when a razorpayAccountId already exists (no duplicate account)', async () => {
		const doc = makeDoctorDoc({ payoutStatus: 'pending_verification', razorpayAccountId: 'acc_existing' });
		Doctor.findByIdWithPayoutKyc = jest.fn().mockResolvedValue(doc);

		const result = await provisionPayoutAccount('doc_1');

		expect(result.status).toBe('already_pending');
		expect(razorpayService.createLinkedAccount).not.toHaveBeenCalled();
	});

	test('throws KYC_INCOMPLETE and never calls Razorpay when KYC has not been submitted', async () => {
		const doc = makeDoctorDoc();
		doc.hasSubmittedPayoutKyc.mockReturnValue(false);
		Doctor.findByIdWithPayoutKyc = jest.fn().mockResolvedValue(doc);

		await expect(provisionPayoutAccount('doc_1')).rejects.toMatchObject({ code: 'KYC_INCOMPLETE' });
		expect(razorpayService.createLinkedAccount).not.toHaveBeenCalled();
		expect(doc.save).not.toHaveBeenCalled();
	});

	test('on success: creates account + stakeholder + product config, stores id, sets pending_verification', async () => {
		const doc = makeDoctorDoc();
		Doctor.findByIdWithPayoutKyc = jest.fn().mockResolvedValue(doc);
		razorpayService.createLinkedAccount.mockResolvedValue({ id: 'acc_new123' });
		razorpayService.createStakeholder.mockResolvedValue({ id: 'sh_1' });
		razorpayService.requestRouteProductConfig.mockResolvedValue({ id: 'prod_1' });

		const result = await provisionPayoutAccount('doc_1');

		expect(razorpayService.createLinkedAccount).toHaveBeenCalledWith(
			expect.objectContaining({ email: 'jane@example.com', phone: '9999999999', pan: 'ABCDE1234F' })
		);
		expect(razorpayService.createStakeholder).toHaveBeenCalledWith('acc_new123', expect.objectContaining({ pan: 'ABCDE1234F' }));
		expect(razorpayService.requestRouteProductConfig).toHaveBeenCalledWith(
			'acc_new123',
			expect.objectContaining({ bankAccount: expect.objectContaining({ accountNumber: '123456789012', ifscCode: 'HDFC0001234' }) })
		);
		expect(doc.razorpayAccountId).toBe('acc_new123');
		expect(doc.payoutStatus).toBe('pending_verification');
		expect(doc.save).toHaveBeenCalled();
		expect(result).toEqual({ status: 'provisioned', payoutStatus: 'pending_verification', razorpayAccountId: 'acc_new123' });
	});

	test('prefers UPI over bank details in the product-config call when only UPI is present', async () => {
		const doc = makeDoctorDoc({
			getDecryptedPayoutKyc: jest.fn().mockReturnValue({
				pan: 'ABCDE1234F',
				bankAccountNumber: null,
				ifscCode: null,
				upiId: 'jane@okhdfcbank',
				legalBusinessName: 'Dr. Jane Doe',
				businessType: 'individual',
				contactEmail: 'jane@example.com',
			}),
		});
		Doctor.findByIdWithPayoutKyc = jest.fn().mockResolvedValue(doc);
		razorpayService.createLinkedAccount.mockResolvedValue({ id: 'acc_new123' });
		razorpayService.createStakeholder.mockResolvedValue({ id: 'sh_1' });
		razorpayService.requestRouteProductConfig.mockResolvedValue({ id: 'prod_1' });

		await provisionPayoutAccount('doc_1');

		expect(razorpayService.requestRouteProductConfig).toHaveBeenCalledWith(
			'acc_new123',
			expect.objectContaining({ vpa: 'jane@okhdfcbank', bankAccount: undefined })
		);
	});

	test('on Razorpay failure: leaves payoutStatus/razorpayAccountId untouched, logs a security event, throws RAZORPAY_CALL_FAILED', async () => {
		const doc = makeDoctorDoc();
		Doctor.findByIdWithPayoutKyc = jest.fn().mockResolvedValue(doc);
		razorpayService.createLinkedAccount.mockRejectedValue(new Error('Razorpay 400: invalid PAN'));

		await expect(provisionPayoutAccount('doc_1')).rejects.toBeInstanceOf(PayoutProvisioningError);
		await expect(provisionPayoutAccount('doc_1')).rejects.toMatchObject({ code: 'RAZORPAY_CALL_FAILED' });

		expect(doc.razorpayAccountId).toBeNull();
		expect(doc.payoutStatus).toBe('not_started');
		expect(doc.save).not.toHaveBeenCalled();
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'doctor_payout_account.provisioning_failed',
			expect.objectContaining({ doctorId: 'doc_1' }),
			expect.any(Object)
		);
	});
});

// Phase 3, task 20: applying the outcome of an async Razorpay Route KYC
// webhook event (account.activated or similar) to the matching Doctor.
describe('handleAccountWebhookEvent', () => {
	function makeActivatableDoctorDoc(overrides = {}) {
		return {
			_id: 'doc_1',
			razorpayAccountId: 'acc_123',
			payoutStatus: 'pending_verification',
			save: jest.fn().mockResolvedValue(true),
			...overrides,
		};
	}

	test('account.activated flips payoutStatus to active and saves', async () => {
		const doc = makeActivatableDoctorDoc();
		Doctor.findByRazorpayAccountId = jest.fn().mockResolvedValue(doc);

		const result = await handleAccountWebhookEvent({ eventType: 'account.activated', razorpayAccountId: 'acc_123' });

		expect(doc.payoutStatus).toBe('active');
		expect(doc.save).toHaveBeenCalled();
		expect(result).toEqual({ handled: true, doctorId: 'doc_1', payoutStatus: 'active' });
	});

	test('account.instantly_activated also flips payoutStatus to active', async () => {
		const doc = makeActivatableDoctorDoc();
		Doctor.findByRazorpayAccountId = jest.fn().mockResolvedValue(doc);

		await handleAccountWebhookEvent({ eventType: 'account.instantly_activated', razorpayAccountId: 'acc_123' });

		expect(doc.payoutStatus).toBe('active');
	});

	test('is idempotent — an already-active doctor is not re-saved', async () => {
		const doc = makeActivatableDoctorDoc({ payoutStatus: 'active' });
		Doctor.findByRazorpayAccountId = jest.fn().mockResolvedValue(doc);

		await handleAccountWebhookEvent({ eventType: 'account.activated', razorpayAccountId: 'acc_123' });

		expect(doc.save).not.toHaveBeenCalled();
	});

	test('account.needs_clarification logs a security event but does not change payoutStatus', async () => {
		const doc = makeActivatableDoctorDoc();
		Doctor.findByRazorpayAccountId = jest.fn().mockResolvedValue(doc);

		const result = await handleAccountWebhookEvent({ eventType: 'account.needs_clarification', razorpayAccountId: 'acc_123' });

		expect(doc.payoutStatus).toBe('pending_verification');
		expect(doc.save).not.toHaveBeenCalled();
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'doctor_payout_account.needs_attention',
			expect.objectContaining({ doctorId: 'doc_1' }),
			expect.objectContaining({ eventType: 'account.needs_clarification' })
		);
		expect(result.handled).toBe(true);
	});

	test('an unrecognized razorpayAccountId is logged and not treated as an error', async () => {
		Doctor.findByRazorpayAccountId = jest.fn().mockResolvedValue(null);

		const result = await handleAccountWebhookEvent({ eventType: 'account.activated', razorpayAccountId: 'acc_ghost' });

		expect(result).toEqual({ handled: false, doctorId: null, payoutStatus: null });
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'doctor_payout_account.webhook_unrecognized_account',
			expect.objectContaining({ razorpayAccountId: 'acc_ghost' }),
			expect.any(Object)
		);
	});

	test('a missing razorpayAccountId is logged and not treated as an error', async () => {
		const result = await handleAccountWebhookEvent({ eventType: 'account.activated', razorpayAccountId: undefined });

		expect(result).toEqual({ handled: false, doctorId: null, payoutStatus: null });
		expect(logSecurityEvent).toHaveBeenCalledWith('doctor_payout_account.webhook_missing_account_id', {}, expect.any(Object));
	});

	test('an unrelated account.* event is logged but ignored', async () => {
		const doc = makeActivatableDoctorDoc();
		Doctor.findByRazorpayAccountId = jest.fn().mockResolvedValue(doc);

		const result = await handleAccountWebhookEvent({ eventType: 'account.updated', razorpayAccountId: 'acc_123' });

		expect(doc.save).not.toHaveBeenCalled();
		expect(logEvent).toHaveBeenCalledWith(
			'doctor_payout_account.webhook_ignored',
			expect.objectContaining({ doctorId: 'doc_1' }),
			expect.objectContaining({ eventType: 'account.updated' })
		);
		expect(result.handled).toBe(false);
	});
});
