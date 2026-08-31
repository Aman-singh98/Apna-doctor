// tests/patientAppointmentController.cancel.test.js
//
// Phase 6, tasks 31/33: PATCH /api/patient/appointments/:id/cancel now
// issues a full refund on the original payment (via refundService) on top
// of the pre-existing status flip. Covers: happy-path refund, the atomic
// { status: 'upcoming' } guard making a retried cancel a no-op instead of
// a second refund attempt, and rejecting cancellation of a non-upcoming
// appointment.

jest.mock('../models/Appointment');
jest.mock('../services/refundService');
jest.mock('../utils/notify', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Appointment = require('../models/Appointment');
const refundService = require('../services/refundService');
const { notify } = require('../utils/notify');
const { cancelAppointment } = require('../controllers/patientAppointmentController');

function makeAppointment(overrides = {}) {
	const appt = {
		_id: 'appt_1',
		doctor: 'doc_1',
		patient: 'pat_1',
		patientName: 'Ravi Kumar',
		type: 'Video',
		status: 'upcoming',
		paymentStatus: 'paid',
		razorpayPaymentId: 'pay_1',
		...overrides,
	};
	appt.populate = jest.fn().mockResolvedValue(appt);
	return appt;
}

function makeReqRes({ id = 'appt_1', patientId = 'pat_1', reason = 'Feeling better, no longer needed' } = {}) {
	const req = { params: { id }, body: { reason }, user: { id: patientId } };
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

describe('cancelAppointment (patient) — task 31/33: refund on cancellation', () => {
	test('cancels the appointment and issues a refund', async () => {
		const appointment = makeAppointment();
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		refundService.refundAppointment.mockResolvedValue({ refunded: true });

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: 'appt_1', patient: 'pat_1', status: 'upcoming' },
			{ status: 'cancelled', cancelReason: 'Feeling better, no longer needed' },
			{ new: true }
		);
		expect(refundService.refundAppointment).toHaveBeenCalledWith({
			appointment,
			reason: 'Feeling better, no longer needed',
			initiatedBy: 'patient',
		});
		expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'doc_1', title: 'Appointment Cancelled' }));
		expect(res.jsonBody).toBe(appointment);
	});

	test('a missing reason is rejected before any refund is attempted', async () => {
		const { req, res } = makeReqRes({ reason: '   ' });
		await cancelAppointment(req, res);

		expect(res.statusCode).toBe(400);
		expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
		expect(refundService.refundAppointment).not.toHaveBeenCalled();
	});

	test('a retried cancel on an already-cancelled appointment is a no-op — never refunds twice', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(makeAppointment({ status: 'cancelled' }));

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(refundService.refundAppointment).not.toHaveBeenCalled();
		expect(res.statusCode).toBeNull(); // default 200
		expect(res.jsonBody).toMatchObject({ status: 'cancelled' });
	});

	test('a completed appointment cannot be cancelled', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(makeAppointment({ status: 'completed' }));

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(res.statusCode).toBe(400);
		expect(refundService.refundAppointment).not.toHaveBeenCalled();
	});

	test('returns 404 when no such appointment exists for this patient', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(null);

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(res.statusCode).toBe(404);
	});

	test('a refund failure does not prevent the cancellation response from succeeding', async () => {
		const appointment = makeAppointment();
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		refundService.refundAppointment.mockResolvedValue({ refunded: false, error: true, message: 'Razorpay is down' });

		const { req, res } = makeReqRes();
		await cancelAppointment(req, res);

		expect(res.jsonBody).toBe(appointment);
		expect(notify).toHaveBeenCalled();
	});
});
