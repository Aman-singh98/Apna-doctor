// tests/razorpayService.routeAccounts.test.js
//
// Phase 3, task 17: input validation for the Route account onboarding
// wrappers (createLinkedAccount / createStakeholder /
// requestRouteProductConfig), mirroring the existing validation-test style
// in tests/razorpayService.test.js — reject bad input before ever calling
// the Razorpay SDK.

process.env.RAZORPAY_KEY_ID = 'rzp_test_unittest';
process.env.RAZORPAY_KEY_SECRET = 'unit_test_key_secret_value';
process.env.RAZORPAY_WEBHOOK_SECRET = 'unit_test_webhook_secret_value';

const razorpayService = require('../services/razorpayService');

describe('razorpayService.createLinkedAccount input validation', () => {
	const valid = {
		email: 'doctor@example.com',
		phone: '9999999999',
		legalBusinessName: 'Dr. Jane Doe',
		businessType: 'individual',
		contactName: 'Jane Doe',
		pan: 'ABCDE1234F',
	};

	test('rejects missing email/phone/legalBusinessName/businessType/contactName', async () => {
		await expect(razorpayService.createLinkedAccount({ ...valid, email: '' })).rejects.toThrow(/email/);
		await expect(razorpayService.createLinkedAccount({ ...valid, phone: '' })).rejects.toThrow(/phone/);
		await expect(razorpayService.createLinkedAccount({ ...valid, legalBusinessName: '' })).rejects.toThrow(
			/legalBusinessName/
		);
		await expect(razorpayService.createLinkedAccount({ ...valid, businessType: '' })).rejects.toThrow(
			/businessType/
		);
		await expect(razorpayService.createLinkedAccount({ ...valid, contactName: '' })).rejects.toThrow(
			/contactName/
		);
	});
});

describe('razorpayService.createStakeholder input validation', () => {
	test('rejects missing accountId/name/email', async () => {
		await expect(razorpayService.createStakeholder('', { name: 'Jane', email: 'a@b.com' })).rejects.toThrow(
			/accountId/
		);
		await expect(razorpayService.createStakeholder('acc_1', { name: '', email: 'a@b.com' })).rejects.toThrow(
			/name/
		);
		await expect(razorpayService.createStakeholder('acc_1', { name: 'Jane', email: '' })).rejects.toThrow(
			/email/
		);
	});
});

describe('razorpayService.requestRouteProductConfig input validation', () => {
	test('rejects a missing accountId', async () => {
		await expect(
			razorpayService.requestRouteProductConfig('', { bankAccount: { accountNumber: '1', ifscCode: 'ABCD0123456' } })
		).rejects.toThrow(/accountId/);
	});

	test('rejects when neither bankAccount nor vpa is provided', async () => {
		await expect(razorpayService.requestRouteProductConfig('acc_1', {})).rejects.toThrow(
			/bankAccount or vpa/
		);
	});
});
