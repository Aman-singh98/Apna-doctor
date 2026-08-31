// tests/appointmentController.cancel.test.js
//
// Phase 6, task 34: the doctor-side cancel/no-show endpoint now applies the
// same refund path as the patient-side cancellation (task 31), gated by
// the same atomic { status: 'upcoming' } transition so a retried/duplicate
// cancel call can never trigger a second refund attempt.

jest.mock('../models/Appointment');
jest.mock('../services/refundService');
jest.mock('../utils/notify', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Appointment = require('../models/Appointment');
const refundService = require('../services/refundService');
const { notify } = require('../utils/notify');
const { cancelAppointment } = require('../controllers/appointmentController');

function makeAppointment(overrides = {}) {
	return {
		_id: 'appt_1',
		doctor: 'doc_1',
		patient: 'pat_1',
		type: 'Video',
		status: 'upcoming',
		paymentStatus: 'paid',
		razorpayPaymentId: 'pay_1',
		...overrides,
	};
}

function makeReqRes({ id = 'appt_1', doctorId = 'doc_1', reason = 'Patient did not show up' } = {}) {
	const req = { params: { id }, body: { reason }, user: { id: doctorId, name: 'Jane' } };
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
});

describe('cancelAppointment (doctor) — task 34: refund on reject/no-show', () => {
	test('cancels the appointment and issues a refund for a no-show', async () => {
		const appointment = makeAppointment();
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		refundService.refundAppointment.mockResolvedValue({ refunded: true });

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: 'appt_1', doctor: 'doc_1', status: 'upcoming' },
			{ status: 'cancelled', cancelReason: 'Patient did not show up' },
			{ new: true }
		);
		expect(refundService.refundAppointment).toHaveBeenCalledWith({
			appointment,
			reason: 'Patient did not show up',
			initiatedBy: 'doctor',
		});
		expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'pat_1', title: 'Appointment Cancelled' }));
		expect(res.jsonBody).toBe(appointment);
	});

	test('a retried cancel on an already-cancelled appointment never refunds twice', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(makeAppointment({ status: 'cancelled' }));

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(refundService.refundAppointment).not.toHaveBeenCalled();
		expect(res.statusCode).toBeNull();
		expect(res.jsonBody).toMatchObject({ status: 'cancelled' });
	});

	test('a completed appointment cannot be cancelled by the doctor', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(makeAppointment({ status: 'completed' }));

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(res.statusCode).toBe(400);
		expect(refundService.refundAppointment).not.toHaveBeenCalled();
	});

	test('returns 404 when no such appointment exists for this doctor', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(null);

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(res.statusCode).toBe(404);
	});

	test('rejects a missing cancellation reason before touching the DB', async () => {
		const { req, res } = makeReqRes({ reason: '' });
		await cancelAppointment(req, res);

		expect(res.statusCode).toBe(400);
		expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
	});
});
