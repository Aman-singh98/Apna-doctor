// tests/refundService.test.js
//
// Phase 6, tasks 31/32/33: refundService is the single place that issues a
// Razorpay refund and (for appointment-backed refunds) walks the
// Transaction/Appointment to a refunded state. Covers: idempotent refund
// issuance (including Razorpay's own "already refunded" error being
// treated as success, not failure), the explicit Route-transfer void
// (task 32) never blocking a refund that already succeeded, skipping
// legacy/never-paid appointments rather than erroring, and never
// double-refunding an appointment that's already marked refunded.

jest.mock('../models/Transaction');
jest.mock('../services/razorpayService');
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Transaction = require('../models/Transaction');
const razorpayService = require('../services/razorpayService');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');
const { refundCapturedPayment, refundAppointment, isAlreadyRefundedError } = require('../services/refundService');

function makeAppointment(overrides = {}) {
	return {
		_id: 'appt_1',
		paymentStatus: 'paid',
		razorpayPaymentId: 'pay_1',
		save: jest.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function makeTransaction(overrides = {}) {
	return {
		_id: 'txn_1',
		appointment: 'appt_1',
		razorpayTransferId: 'trf_1',
		onHold: true,
		status: 'pending',
		save: jest.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe('isAlreadyRefundedError', () => {
	test('recognizes a Razorpay "already refunded" error shape', () => {
		const err = { statusCode: 400, error: { code: 'BAD_REQUEST_ERROR', description: 'The payment has already been fully refunded.' } };
		expect(isAlreadyRefundedError(err)).toBe(true);
	});

	test('does not match unrelated errors', () => {
		expect(isAlreadyRefundedError(new Error('Network timeout'))).toBe(false);
		expect(isAlreadyRefundedError({ error: { description: 'Invalid payment id' } })).toBe(false);
	});
});

describe('refundCapturedPayment — slot-clash refunds with no Appointment/Transaction', () => {
	test('issues a refund and returns refunded: true', async () => {
		razorpayService.issueRefund.mockResolvedValue({ id: 'rfnd_1' });

		const result = await refundCapturedPayment({ paymentId: 'pay_1', reason: 'slot_clash' });

		expect(razorpayService.issueRefund).toHaveBeenCalledWith({ paymentId: 'pay_1', notes: { reason: 'slot_clash' } });
		expect(result).toEqual({ refunded: true, refundId: 'rfnd_1' });
	});

	test('treats a gateway "already refunded" error as success, not failure', async () => {
		razorpayService.issueRefund.mockRejectedValue({
			error: { description: 'The payment has already been fully refunded.' },
		});

		const result = await refundCapturedPayment({ paymentId: 'pay_1', reason: 'slot_clash' });

		expect(result).toEqual({ refunded: true, alreadyRefunded: true });
		expect(logEvent).toHaveBeenCalledWith(
			'refund.already_refunded_on_gateway',
			expect.objectContaining({ paymentId: 'pay_1' }),
			expect.any(Object)
		);
	});

	test('a genuine gateway failure is reported, not thrown', async () => {
		razorpayService.issueRefund.mockRejectedValue(new Error('Razorpay is down'));

		const result = await refundCapturedPayment({ paymentId: 'pay_1', reason: 'slot_clash' });

		expect(result).toEqual({ refunded: false, error: true, message: 'Razorpay is down' });
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'refund.issue_failed',
			expect.objectContaining({ paymentId: 'pay_1' }),
			expect.objectContaining({ message: 'Razorpay is down' })
		);
	});

	test('skips with no gateway call when paymentId is missing', async () => {
		const result = await refundCapturedPayment({ paymentId: undefined, reason: 'slot_clash' });

		expect(razorpayService.issueRefund).not.toHaveBeenCalled();
		expect(result).toEqual({ refunded: false, skipped: true });
	});
});

describe('refundAppointment — tasks 31/33: full refund + Transaction update', () => {
	test('refunds the payment, voids the transfer, and marks Appointment + Transaction refunded', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction();
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.issueRefund.mockResolvedValue({ id: 'rfnd_1' });
		razorpayService.holdTransfer.mockResolvedValue({ id: 'trf_1', on_hold: 1 });

		const result = await refundAppointment({ appointment, reason: 'Patient cancelled', initiatedBy: 'patient' });

		expect(razorpayService.issueRefund).toHaveBeenCalledWith({ paymentId: 'pay_1', notes: { reason: 'Patient cancelled' } });
		expect(razorpayService.holdTransfer).toHaveBeenCalledWith('trf_1');
		expect(transaction.status).toBe('refunded');
		expect(transaction.onHold).toBe(true);
		expect(transaction.save).toHaveBeenCalled();
		expect(appointment.paymentStatus).toBe('refunded');
		expect(appointment.save).toHaveBeenCalled();
		expect(result).toEqual({ refunded: true, alreadyRefunded: false });
	});

	test('task 32: an explicit transfer-void failure never blocks the refund from completing', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction();
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.issueRefund.mockResolvedValue({ id: 'rfnd_1' });
		// Simulates Razorpay having already auto-voided the transfer by the
		// time this explicit call runs — an expected outcome per task 32.
		razorpayService.holdTransfer.mockRejectedValue(new Error('Transfer already settled'));

		const result = await refundAppointment({ appointment, reason: 'no-show', initiatedBy: 'doctor' });

		expect(result.refunded).toBe(true);
		expect(transaction.status).toBe('refunded'); // still updated despite the void call failing
		expect(appointment.paymentStatus).toBe('refunded');
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'refund.transfer_void_failed',
			expect.objectContaining({ transferId: 'trf_1' }),
			expect.objectContaining({ message: 'Transfer already settled' })
		);
	});

	test('a genuine refund failure leaves the Appointment/Transaction untouched', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction();
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.issueRefund.mockRejectedValue(new Error('Razorpay is down'));

		const result = await refundAppointment({ appointment, reason: 'Patient cancelled', initiatedBy: 'patient' });

		expect(result).toEqual({ refunded: false, error: true, message: 'Razorpay is down' });
		expect(appointment.paymentStatus).toBe('paid'); // unchanged
		expect(appointment.save).not.toHaveBeenCalled();
		expect(transaction.save).not.toHaveBeenCalled();
		expect(razorpayService.holdTransfer).not.toHaveBeenCalled();
	});

	test('skips a legacy appointment with no razorpayPaymentId on record', async () => {
		const appointment = makeAppointment({ paymentStatus: undefined, razorpayPaymentId: undefined });

		const result = await refundAppointment({ appointment, reason: 'Doctor cancelled', initiatedBy: 'doctor' });

		expect(razorpayService.issueRefund).not.toHaveBeenCalled();
		expect(result).toEqual({ refunded: false, skipped: true });
		expect(appointment.save).not.toHaveBeenCalled();
	});

	test('is a no-op (does not call Razorpay again) if the appointment is already refunded', async () => {
		const appointment = makeAppointment({ paymentStatus: 'refunded' });

		const result = await refundAppointment({ appointment, reason: 'retry', initiatedBy: 'patient' });

		expect(razorpayService.issueRefund).not.toHaveBeenCalled();
		expect(result).toEqual({ refunded: false, alreadyRefunded: true });
	});

	test('does not attempt to void a transfer when the Transaction never got one (no linked account at booking time)', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction({ razorpayTransferId: undefined });
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.issueRefund.mockResolvedValue({ id: 'rfnd_1' });

		await refundAppointment({ appointment, reason: 'Patient cancelled', initiatedBy: 'patient' });

		expect(razorpayService.holdTransfer).not.toHaveBeenCalled();
		expect(transaction.status).toBe('refunded');
	});

	test('handles a legacy Appointment with no Transaction at all', async () => {
		const appointment = makeAppointment();
		Transaction.findOne.mockResolvedValue(null);
		razorpayService.issueRefund.mockResolvedValue({ id: 'rfnd_1' });

		const result = await refundAppointment({ appointment, reason: 'Patient cancelled', initiatedBy: 'patient' });

		expect(result.refunded).toBe(true);
		expect(appointment.paymentStatus).toBe('refunded');
		expect(razorpayService.holdTransfer).not.toHaveBeenCalled();
	});
});
