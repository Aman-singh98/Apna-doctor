// tests/appointmentController.complete.test.js
//
// Phase 5, tasks 27-28: PATCH /api/appointments/:id/complete now releases
// the doctor's held Route transfer (task 27) and reflects that on the
// Transaction, pending -> credited (task 28), on top of the pre-existing
// status flip + patient notification.
//
// Appointment/Transaction models, razorpayService, and notify are all
// mocked so these tests exercise only appointmentController's own decision
// logic — no real DB or network call.

jest.mock('../models/Appointment');
jest.mock('../models/Transaction');
jest.mock('../services/razorpayService');
jest.mock('../utils/notify', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Appointment = require('../models/Appointment');
const Transaction = require('../models/Transaction');
const razorpayService = require('../services/razorpayService');
const { notify } = require('../utils/notify');
const { logEvent, logSecurityEvent } = require('../utils/paymentLogger');
const { completeAppointment } = require('../controllers/appointmentController');

function makeAppointment(overrides = {}) {
	return {
		_id: 'appt_1',
		doctor: 'doc_1',
		patient: 'pat_1',
		type: 'Video',
		status: 'completed',
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

function makeReqRes({ id = 'appt_1', doctorId = 'doc_1' } = {}) {
	const req = { params: { id }, user: { id: doctorId, name: 'Dr. Jane' } };
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

describe('completeAppointment — task 27: release the held Route transfer', () => {
	test('releases the transfer, marks it off-hold, and completes the appointment', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction();
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.releaseTransfer.mockResolvedValue({ id: 'trf_1', on_hold: false });

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: 'appt_1', doctor: 'doc_1', status: 'upcoming' },
			{ status: 'completed', completedAt: expect.any(Date) },
			{ new: true }
		);
		expect(razorpayService.releaseTransfer).toHaveBeenCalledWith('trf_1');
		expect(transaction.onHold).toBe(false);
		expect(transaction.save).toHaveBeenCalled();
		expect(res.statusCode).toBeNull(); // default 200, res.json called directly
		expect(res.jsonBody).toEqual(appointment);
		expect(notify).toHaveBeenCalledWith(
			expect.objectContaining({ recipientId: 'pat_1', title: 'Consultation Completed' })
		);
	});

	test('never calls releaseTransfer twice for the same appointment (idempotent complete)', async () => {
		// First call: appointment is 'upcoming', update succeeds normally.
		const appointment = makeAppointment();
		const transaction = makeTransaction();
		Appointment.findOneAndUpdate.mockResolvedValueOnce(appointment);
		Transaction.findOne.mockResolvedValueOnce(transaction);
		razorpayService.releaseTransfer.mockResolvedValue({ id: 'trf_1' });

		const first = makeReqRes();
		await completeAppointment(first.req, first.res);

		// Second call: the { status: 'upcoming' } filter no longer matches
		// (it's 'completed' now), so the update returns null and the
		// fallback branch runs instead.
		Appointment.findOneAndUpdate.mockResolvedValueOnce(null);
		Appointment.findOne.mockResolvedValueOnce(makeAppointment({ status: 'completed' }));

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(razorpayService.releaseTransfer).toHaveBeenCalledTimes(1);
		expect(Transaction.findOne).toHaveBeenCalledTimes(1); // not looked up again on the no-op path
		expect(res.jsonBody).toMatchObject({ status: 'completed' });
	});

	test('a second complete call on an already-completed appointment is a no-op, not a 404', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(makeAppointment({ status: 'completed' }));

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(res.statusCode).toBeNull();
		expect(res.jsonBody).toMatchObject({ status: 'completed' });
		expect(Transaction.findOne).not.toHaveBeenCalled();
		expect(razorpayService.releaseTransfer).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
	});

	test('a cancelled appointment cannot be completed', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(makeAppointment({ status: 'cancelled' }));

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(res.statusCode).toBe(400);
		expect(razorpayService.releaseTransfer).not.toHaveBeenCalled();
	});

	test('returns 404 when the appointment does not exist for this doctor', async () => {
		Appointment.findOneAndUpdate.mockResolvedValue(null);
		Appointment.findOne.mockResolvedValue(null);

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(res.statusCode).toBe(404);
	});
});

describe('completeAppointment — task 28: Transaction pending -> credited', () => {
	test('flips status from pending to credited only after a successful release', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction({ status: 'pending', onHold: true });
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.releaseTransfer.mockResolvedValue({});

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(transaction.status).toBe('credited');
		expect(logEvent).toHaveBeenCalledWith(
			'consultation.complete.transfer_released',
			expect.objectContaining({ appointmentId: 'appt_1', transferId: 'trf_1' }),
			expect.any(Object)
		);
	});

	test('does not overwrite a non-pending status (e.g. already credited by a transfer.processed webhook)', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction({ status: 'credited', onHold: true });
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.releaseTransfer.mockResolvedValue({});

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(transaction.status).toBe('credited'); // unchanged, not re-derived
		expect(transaction.onHold).toBe(false); // still updated
	});

	test('a Razorpay release failure leaves the Transaction on_hold/pending and completes anyway', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction({ status: 'pending', onHold: true });
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		Transaction.findOne.mockResolvedValue(transaction);
		razorpayService.releaseTransfer.mockRejectedValue(new Error('Razorpay timeout'));

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(transaction.onHold).toBe(true); // untouched
		expect(transaction.status).toBe('pending'); // untouched
		expect(transaction.save).not.toHaveBeenCalled();
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'consultation.complete.transfer_release_failed',
			expect.objectContaining({ appointmentId: 'appt_1', transferId: 'trf_1' }),
			expect.objectContaining({ message: 'Razorpay timeout' })
		);
		// The appointment itself is still marked completed — a payout-side
		// failure must never undo that the consult happened.
		expect(res.jsonBody).toEqual(appointment);
		expect(notify).toHaveBeenCalled();
	});

	test('no transfer was ever created (e.g. doctor had no linked account) — flagged, not silently credited', async () => {
		const appointment = makeAppointment();
		const transaction = makeTransaction({ razorpayTransferId: undefined, onHold: true, status: 'pending' });
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		Transaction.findOne.mockResolvedValue(transaction);

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(razorpayService.releaseTransfer).not.toHaveBeenCalled();
		expect(transaction.status).toBe('pending'); // left alone for admin reconciliation
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'consultation.complete.no_transfer_to_release',
			expect.objectContaining({ appointmentId: 'appt_1' }),
			expect.any(Object)
		);
	});

	test('a legacy appointment with no Transaction at all completes exactly as before', async () => {
		const appointment = makeAppointment();
		Appointment.findOneAndUpdate.mockResolvedValue(appointment);
		Transaction.findOne.mockResolvedValue(null);

		const { req, res } = makeReqRes();
		await completeAppointment(req, res);

		expect(razorpayService.releaseTransfer).not.toHaveBeenCalled();
		expect(res.jsonBody).toEqual(appointment);
		expect(notify).toHaveBeenCalled();
	});
});
