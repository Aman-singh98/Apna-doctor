// tests/paymentWebhookService.test.js
//
// Phase 4, task 22: the payment.captured webhook safety net that creates
// an Appointment (+ Transaction + Route transfer) when the app-driven
// confirmation call never arrived. Covers: no-op when the Appointment
// already exists, happy-path creation from PendingPaymentOrder, the
// notes-based fallback when PendingPaymentOrder has expired, refusing to
// guess when neither source has enough data, the slot-clash guard, a
// unique-index race with the app-driven path, and a Route-transfer
// failure not undoing the booking.
//
// All models/services this depends on are mocked — no real DB or network
// call, same pattern as tests/doctorPayoutService.test.js.

jest.mock('../models/Appointment');
jest.mock('../models/Doctor');
jest.mock('../models/Patient');
jest.mock('../models/FamilyMember');
jest.mock('../models/Transaction');
jest.mock('../models/PendingPaymentOrder');
jest.mock('../services/razorpayService');
jest.mock('../services/refundService');
jest.mock('../utils/notify', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const FamilyMember = require('../models/FamilyMember');
const Transaction = require('../models/Transaction');
const PendingPaymentOrder = require('../models/PendingPaymentOrder');
const razorpayService = require('../services/razorpayService');
const refundService = require('../services/refundService');
const { logSecurityEvent } = require('../utils/paymentLogger');
const {
	handlePaymentCapturedEvent,
	handlePaymentFailedEvent,
	handleTransferProcessedEvent,
} = require('../services/paymentWebhookService');

function makePendingOrder(overrides = {}) {
	return {
		_id: 'ppo_1',
		doctor: 'doc_1',
		patient: 'pat_1',
		familyMember: null,
		type: 'Video',
		date: new Date('2026-09-01T10:00:00.000Z'),
		totalAmount: 399,
		doctorAmount: 279.3,
		platformAmount: 119.7,
		...overrides,
	};
}

function makeDoctor(overrides = {}) {
	return {
		_id: 'doc_1',
		category: 'gp',
		razorpayAccountId: 'acc_doc_1',
		...overrides,
	};
}

function makeSelectChain(resolvedValue) {
	// Doctor.findOne(...).select('+razorpayAccountId') — mimic mongoose's
	// chainable query object just enough for this file's calls.
	return { select: jest.fn().mockResolvedValue(resolvedValue) };
}

function basePaymentEntity(overrides = {}) {
	return {
		id: 'pay_1',
		order_id: 'order_1',
		amount: 39900,
		notes: {},
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	Appointment.findOne = jest.fn().mockResolvedValue(null);
	Appointment.create = jest.fn();
	PendingPaymentOrder.findOne = jest.fn().mockResolvedValue(null);
	PendingPaymentOrder.deleteOne = jest.fn().mockResolvedValue(undefined);
	Doctor.findOne = jest.fn().mockReturnValue(makeSelectChain(null));
	Patient.findById = jest.fn().mockResolvedValue(null);
	FamilyMember.findOne = jest.fn().mockResolvedValue(null);
	Transaction.create = jest.fn().mockResolvedValue({ _id: 'txn_1' });
	razorpayService.createRouteTransfer = jest.fn().mockResolvedValue({ id: 'trf_1' });
});

describe('handlePaymentCapturedEvent — already booked', () => {
	test('no-ops when an Appointment already exists for this order (app-driven path won)', async () => {
		Appointment.findOne.mockResolvedValueOnce({ _id: 'appt_existing' });

		const result = await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(result).toEqual({ handled: true, created: false, appointmentId: 'appt_existing' });
		expect(PendingPaymentOrder.findOne).not.toHaveBeenCalled();
		expect(Appointment.create).not.toHaveBeenCalled();
	});
});

describe('handlePaymentCapturedEvent — missing identifiers', () => {
	test('backs off without creating anything when order_id/id are missing', async () => {
		const result = await handlePaymentCapturedEvent({ paymentEntity: { id: null, order_id: null } });

		expect(result).toEqual({ handled: false, created: false });
		expect(Appointment.create).not.toHaveBeenCalled();
	});
});

describe('handlePaymentCapturedEvent — happy path via PendingPaymentOrder', () => {
	test('creates the Appointment, Transaction, and a held Route transfer', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce(makePendingOrder());
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor()));
		Patient.findById.mockResolvedValueOnce({ _id: 'pat_1', name: 'Ravi Kumar' });
		Appointment.create.mockResolvedValueOnce({ _id: 'appt_new' });

		const result = await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(Appointment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				doctor: 'doc_1',
				patient: 'pat_1',
				patientName: 'Ravi Kumar',
				type: 'Video',
				fee: 399,
				razorpayOrderId: 'order_1',
				razorpayPaymentId: 'pay_1',
				paymentStatus: 'paid',
			})
		);
		expect(razorpayService.createRouteTransfer).toHaveBeenCalledWith(
			expect.objectContaining({ paymentId: 'pay_1', doctorAccountId: 'acc_doc_1', amountInRupees: 279.3, onHold: true })
		);
		expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ razorpayTransferId: 'trf_1', onHold: true }));
		expect(PendingPaymentOrder.deleteOne).toHaveBeenCalledWith({ _id: 'ppo_1' });
		expect(result).toEqual({ handled: true, created: true, appointmentId: 'appt_new' });
	});

	test('books for a family member when PendingPaymentOrder has one', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce(makePendingOrder({ familyMember: 'fam_1' }));
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor()));
		FamilyMember.findOne.mockResolvedValueOnce({ _id: 'fam_1', name: 'Little Kumar' });
		Appointment.create.mockResolvedValueOnce({ _id: 'appt_new' });

		await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(Patient.findById).not.toHaveBeenCalled();
		expect(Appointment.create).toHaveBeenCalledWith(
			expect.objectContaining({ familyMember: 'fam_1', patientName: 'Little Kumar' })
		);
	});

	test('skips the Route transfer (but still creates the Appointment) when the doctor has no linked account', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce(makePendingOrder());
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor({ razorpayAccountId: null })));
		Patient.findById.mockResolvedValueOnce({ _id: 'pat_1', name: 'Ravi Kumar' });
		Appointment.create.mockResolvedValueOnce({ _id: 'appt_new' });

		const result = await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(razorpayService.createRouteTransfer).not.toHaveBeenCalled();
		expect(Transaction.create).toHaveBeenCalledWith(expect.not.objectContaining({ razorpayTransferId: expect.anything() }));
		expect(result.created).toBe(true);
	});

	test('a transfer failure still leaves the Appointment created', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce(makePendingOrder());
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor()));
		Patient.findById.mockResolvedValueOnce({ _id: 'pat_1', name: 'Ravi Kumar' });
		Appointment.create.mockResolvedValueOnce({ _id: 'appt_new' });
		razorpayService.createRouteTransfer.mockRejectedValueOnce(new Error('razorpay down'));

		const result = await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(result).toEqual({ handled: true, created: true, appointmentId: 'appt_new' });
		expect(Transaction.create).toHaveBeenCalled();
	});
});

describe('handlePaymentCapturedEvent — notes fallback (PendingPaymentOrder expired)', () => {
	test('reconstructs the booking from notes and recomputes fees from doctorFeeConfig', async () => {
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor({ category: 'gp' })));
		Patient.findById.mockResolvedValueOnce({ _id: 'pat_1', name: 'Ravi Kumar' });
		Appointment.create.mockResolvedValueOnce({ _id: 'appt_new' });

		const paymentEntity = basePaymentEntity({
			notes: {
				doctorId: 'doc_1',
				patientId: 'pat_1',
				type: 'Video',
				date: '2026-09-01T10:00:00.000Z',
			},
		});

		const result = await handlePaymentCapturedEvent({ paymentEntity });

		expect(Appointment.create).toHaveBeenCalledWith(expect.objectContaining({ fee: 399 })); // gp video fee, from config
		expect(result.created).toBe(true);
	});

	test('backs off (logs security event, creates nothing) when notes are also incomplete', async () => {
		const paymentEntity = basePaymentEntity({ notes: { doctorId: 'doc_1' } }); // missing patientId/type/date

		const result = await handlePaymentCapturedEvent({ paymentEntity });

		expect(result).toEqual({ handled: false, created: false });
		expect(Appointment.create).not.toHaveBeenCalled();
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'webhook.payment_captured.unrecoverable',
			expect.objectContaining({ orderId: 'order_1', paymentId: 'pay_1' }),
			expect.any(Object)
		);
	});
});

describe('handlePaymentCapturedEvent — slot clash (Phase 6, task 56)', () => {
	test('does not create a second Appointment, and refunds the losing payment instead', async () => {
		const pendingOrder = makePendingOrder();
		PendingPaymentOrder.findOne.mockResolvedValueOnce(pendingOrder);
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor()));
		Patient.findById.mockResolvedValueOnce({ _id: 'pat_1', name: 'Ravi Kumar' });
		Appointment.findOne.mockResolvedValueOnce(null); // "already exists for this order?" check
		Appointment.findOne.mockResolvedValueOnce({ _id: 'appt_other' }); // slot-clash check
		refundService.refundCapturedPayment.mockResolvedValue({ refunded: true });
		PendingPaymentOrder.deleteOne.mockResolvedValue({});

		const result = await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(result).toEqual({ handled: true, created: false, slotClash: true, refunded: true });
		expect(Appointment.create).not.toHaveBeenCalled();
		expect(refundService.refundCapturedPayment).toHaveBeenCalledWith({
			paymentId: 'pay_1',
			reason: 'slot_clash',
			correlationIds: { orderId: 'order_1' },
		});
		expect(PendingPaymentOrder.deleteOne).toHaveBeenCalledWith({ _id: pendingOrder._id });
	});

	test('still reports the clash even if the refund itself fails, and does not throw', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce(makePendingOrder());
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor()));
		Patient.findById.mockResolvedValueOnce({ _id: 'pat_1', name: 'Ravi Kumar' });
		Appointment.findOne.mockResolvedValueOnce(null);
		Appointment.findOne.mockResolvedValueOnce({ _id: 'appt_other' });
		refundService.refundCapturedPayment.mockResolvedValue({ refunded: false, error: true });

		const result = await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(result).toEqual({ handled: true, created: false, slotClash: true, refunded: false });
	});
});

describe('handlePaymentCapturedEvent — race with the app-driven path', () => {
	test('reports the winning Appointment instead of erroring on a duplicate-key race', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce(makePendingOrder());
		Doctor.findOne.mockReturnValueOnce(makeSelectChain(makeDoctor()));
		Patient.findById.mockResolvedValueOnce({ _id: 'pat_1', name: 'Ravi Kumar' });

		const dupErr = new Error('duplicate key');
		dupErr.code = 11000;
		Appointment.create.mockRejectedValueOnce(dupErr);
		Appointment.findOne.mockResolvedValueOnce(null); // initial "already exists?" check
		Appointment.findOne.mockResolvedValueOnce(null); // slot-clash check
		Appointment.findOne.mockResolvedValueOnce({ _id: 'appt_winner' }); // re-lookup after the race

		const result = await handlePaymentCapturedEvent({ paymentEntity: basePaymentEntity() });

		expect(result).toEqual({ handled: true, created: false, appointmentId: 'appt_winner' });
	});
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 4, task 23 — payment.failed

describe('handlePaymentFailedEvent', () => {
	function basePaymentFailedEntity(overrides = {}) {
		return {
			id: 'pay_fail_1',
			order_id: 'order_fail_1',
			error_code: 'BAD_REQUEST_ERROR',
			error_description: 'Payment processing failed',
			...overrides,
		};
	}

	test('backs off without touching anything when order_id is missing', async () => {
		const result = await handlePaymentFailedEvent({ paymentEntity: { id: 'pay_1', order_id: null } });

		expect(result).toEqual({ handled: false });
		expect(PendingPaymentOrder.findOne).not.toHaveBeenCalled();
	});

	test('cleans up the dead PendingPaymentOrder and logs the failure', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce({ _id: 'ppo_fail_1' });

		const result = await handlePaymentFailedEvent({ paymentEntity: basePaymentFailedEntity() });

		expect(result).toEqual({ handled: true });
		expect(PendingPaymentOrder.deleteOne).toHaveBeenCalledWith({ _id: 'ppo_fail_1' });
	});

	test('is a no-op (nothing to delete) when there is no matching PendingPaymentOrder', async () => {
		PendingPaymentOrder.findOne.mockResolvedValueOnce(null);

		const result = await handlePaymentFailedEvent({ paymentEntity: basePaymentFailedEntity() });

		expect(result).toEqual({ handled: true });
		expect(PendingPaymentOrder.deleteOne).not.toHaveBeenCalled();
	});

	test('does not touch anything if an Appointment somehow already exists for this order', async () => {
		Appointment.findOne.mockResolvedValueOnce({ _id: 'appt_unexpected' });

		const result = await handlePaymentFailedEvent({ paymentEntity: basePaymentFailedEntity() });

		expect(result).toEqual({ handled: true });
		expect(PendingPaymentOrder.findOne).not.toHaveBeenCalled();
		expect(PendingPaymentOrder.deleteOne).not.toHaveBeenCalled();
	});
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 4, task 24 — transfer.processed

describe('handleTransferProcessedEvent', () => {
	function makeTransactionDoc(overrides = {}) {
		return {
			_id: 'txn_1',
			appointment: 'appt_1',
			status: 'pending',
			onHold: true,
			save: jest.fn().mockResolvedValue(undefined),
			...overrides,
		};
	}

	test('backs off when transfer id is missing', async () => {
		const result = await handleTransferProcessedEvent({ transferEntity: { id: null } });

		expect(result).toEqual({ handled: false });
		expect(Transaction.findOne).not.toHaveBeenCalled();
	});

	test('logs and backs off when no Transaction matches the transfer id', async () => {
		Transaction.findOne = jest.fn().mockResolvedValue(null);

		const result = await handleTransferProcessedEvent({ transferEntity: { id: 'trf_unknown', on_hold: false } });

		expect(result).toEqual({ handled: false });
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'webhook.transfer_processed.unrecognized_transfer',
			expect.objectContaining({ transferId: 'trf_unknown' }),
			expect.any(Object)
		);
	});

	test('moves a pending, no-longer-on-hold transfer to credited and clears onHold', async () => {
		const txn = makeTransactionDoc({ status: 'pending', onHold: true });
		Transaction.findOne = jest.fn().mockResolvedValue(txn);

		const result = await handleTransferProcessedEvent({ transferEntity: { id: 'trf_1', on_hold: false } });

		expect(txn.status).toBe('credited');
		expect(txn.onHold).toBe(false);
		expect(txn.save).toHaveBeenCalled();
		expect(result).toEqual({ handled: true, changed: true, transactionId: 'txn_1' });
	});

	test('never overwrites a refunded/failed status even if the transfer reports processed', async () => {
		const txn = makeTransactionDoc({ status: 'refunded', onHold: false });
		Transaction.findOne = jest.fn().mockResolvedValue(txn);

		await handleTransferProcessedEvent({ transferEntity: { id: 'trf_1', on_hold: false } });

		expect(txn.status).toBe('refunded');
	});

	test('is a no-op (no save call) when nothing actually changed', async () => {
		const txn = makeTransactionDoc({ status: 'credited', onHold: false });
		Transaction.findOne = jest.fn().mockResolvedValue(txn);

		const result = await handleTransferProcessedEvent({ transferEntity: { id: 'trf_1', on_hold: false } });

		expect(txn.save).not.toHaveBeenCalled();
		expect(result).toEqual({ handled: true, changed: false, transactionId: 'txn_1' });
	});
});
