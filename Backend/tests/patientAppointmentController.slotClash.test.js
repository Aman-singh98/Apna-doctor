// tests/patientAppointmentController.slotClash.test.js
//
// Phase 6, task 56: when a payment verifies for a slot another payment
// already won, the loser's payment is now refunded (previously this branch
// just failed closed with the money still captured, flagged "Phase 6" in
// the response message — see the task doc's own note on Flow F). Covers
// only the slot-clash branch of createAppointment; the rest of that
// endpoint's behavior is unchanged from Phase 2/4.

jest.mock('../models/Appointment');
jest.mock('../models/Doctor');
jest.mock('../models/FamilyMember');
jest.mock('../models/Transaction');
jest.mock('../models/PendingPaymentOrder');
jest.mock('../services/razorpayService');
jest.mock('../services/refundService');
jest.mock('../utils/notify', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const PendingPaymentOrder = require('../models/PendingPaymentOrder');
const razorpayService = require('../services/razorpayService');
const refundService = require('../services/refundService');
const { createAppointment } = require('../controllers/patientAppointmentController');

function makeReqRes() {
	const req = {
		body: {
			doctorId: 'doc_1',
			date: '2026-09-01T10:00:00.000Z',
			type: 'Video',
			razorpay_order_id: 'order_1',
			razorpay_payment_id: 'pay_1',
			razorpay_signature: 'sig_1',
		},
		user: { id: 'pat_1', name: 'Ravi Kumar', phone: '9999999999' },
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

function makePendingOrder(overrides = {}) {
	return {
		_id: 'ppo_1',
		patient: 'pat_1',
		doctor: 'doc_1',
		type: 'Video',
		familyMember: null,
		date: new Date('2026-09-01T10:00:00.000Z'),
		totalAmount: 399,
		doctorAmount: 279.3,
		platformAmount: 119.7,
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	razorpayService.verifyPaymentSignature.mockReturnValue(true);
	Doctor.findOne.mockResolvedValue({ _id: 'doc_1', category: 'gp', razorpayAccountId: 'acc_1' });
	PendingPaymentOrder.deleteOne.mockResolvedValue({});
});

test('refunds the losing payment, cleans up the pending order, and never creates an Appointment', async () => {
	const pendingOrder = makePendingOrder();
	Appointment.findOne
		.mockResolvedValueOnce(null) // "already created for this order?" check
		.mockResolvedValueOnce({ _id: 'appt_winner' }); // slot-clash check
	PendingPaymentOrder.findOne.mockResolvedValue(pendingOrder);
	refundService.refundCapturedPayment.mockResolvedValue({ refunded: true });

	const { req, res } = makeReqRes();
	await createAppointment(req, res);

	expect(refundService.refundCapturedPayment).toHaveBeenCalledWith({
		paymentId: 'pay_1',
		reason: 'slot_clash',
		correlationIds: { orderId: 'order_1' },
	});
	expect(PendingPaymentOrder.deleteOne).toHaveBeenCalledWith({ _id: 'ppo_1' });
	expect(Appointment.create).not.toHaveBeenCalled();
	expect(res.statusCode).toBe(409);
	expect(res.jsonBody.message).toMatch(/refunded/i);
});

test('still returns 409 even if the refund attempt itself fails', async () => {
	const pendingOrder = makePendingOrder();
	Appointment.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'appt_winner' });
	PendingPaymentOrder.findOne.mockResolvedValue(pendingOrder);
	refundService.refundCapturedPayment.mockResolvedValue({ refunded: false, error: true, message: 'Razorpay is down' });

	const { req, res } = makeReqRes();
	await createAppointment(req, res);

	expect(res.statusCode).toBe(409);
	expect(Appointment.create).not.toHaveBeenCalled();
});
