// tests/transferHoldMonitorJob.test.js
//
// Phase 5, task 30: alert on any Route transfer stuck on_hold past a
// reasonable SLA after consultation completion.
//
// Transaction model and notify's notifyAllAdmins are mocked so this only
// exercises the job's own filtering/alerting decision logic, not a real DB
// or push send.

jest.mock('../models/Transaction');
jest.mock('../utils/notify', () => ({ notifyAllAdmins: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/paymentLogger', () => ({ logEvent: jest.fn(), logSecurityEvent: jest.fn() }));

const Transaction = require('../models/Transaction');
const { notifyAllAdmins } = require('../utils/notify');
const { logSecurityEvent } = require('../utils/paymentLogger');
const { runCheck } = require('../jobs/transferHoldMonitorJob');

const ONE_HOUR_MS = 60 * 60 * 1000;

function makeTransaction({ hoursSinceCompletion, alreadyAlertedHoursAgo, appointment = {} } = {}) {
	const completedAt =
		hoursSinceCompletion === undefined ? undefined : new Date(Date.now() - hoursSinceCompletion * ONE_HOUR_MS);

	return {
		_id: 'txn_1',
		doctor: 'doc_1',
		razorpayTransferId: 'trf_1',
		onHold: true,
		status: 'pending',
		staleTransferAlertSentAt:
			alreadyAlertedHoursAgo !== undefined ? new Date(Date.now() - alreadyAlertedHoursAgo * ONE_HOUR_MS) : undefined,
		appointment: {
			_id: 'appt_1',
			status: 'completed',
			completedAt,
			...appointment,
		},
		save: jest.fn().mockResolvedValue(undefined),
	};
}

function mockFind(transactions) {
	Transaction.find.mockReturnValue({
		populate: jest.fn().mockResolvedValue(transactions),
	});
}

beforeEach(() => {
	jest.clearAllMocks();
	delete process.env.TRANSFER_HOLD_SLA_HOURS;
});

describe('transferHoldMonitorJob — flagging logic', () => {
	test('flags a transfer stuck well past the default (6h) SLA', async () => {
		const txn = makeTransaction({ hoursSinceCompletion: 10 });
		mockFind([txn]);

		await runCheck();

		expect(notifyAllAdmins).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'payment_alert',
				meta: expect.objectContaining({ transactionId: 'txn_1', appointmentId: 'appt_1', transferId: 'trf_1' }),
			})
		);
		expect(logSecurityEvent).toHaveBeenCalledWith(
			'monitor.transfer_stuck_on_hold',
			expect.objectContaining({ transactionId: 'txn_1' }),
			expect.objectContaining({ doctorId: 'doc_1', ageHours: 10 })
		);
		expect(txn.staleTransferAlertSentAt).toBeInstanceOf(Date);
		expect(txn.save).toHaveBeenCalled();
	});

	test('does not flag a transfer still within the SLA window', async () => {
		const txn = makeTransaction({ hoursSinceCompletion: 2 }); // under default 6h SLA
		mockFind([txn]);

		await runCheck();

		expect(notifyAllAdmins).not.toHaveBeenCalled();
		expect(txn.save).not.toHaveBeenCalled();
	});

	test('does not re-alert within 24h of a prior alert', async () => {
		const txn = makeTransaction({ hoursSinceCompletion: 12, alreadyAlertedHoursAgo: 2 });
		mockFind([txn]);

		await runCheck();

		expect(notifyAllAdmins).not.toHaveBeenCalled();
	});

	test('re-alerts once the prior alert is more than 24h old', async () => {
		const txn = makeTransaction({ hoursSinceCompletion: 30, alreadyAlertedHoursAgo: 25 });
		mockFind([txn]);

		await runCheck();

		expect(notifyAllAdmins).toHaveBeenCalledTimes(1);
	});

	test('ignores an appointment that has not completed yet', async () => {
		const txn = makeTransaction({ hoursSinceCompletion: 10, appointment: { status: 'upcoming' } });
		mockFind([txn]);

		await runCheck();

		expect(notifyAllAdmins).not.toHaveBeenCalled();
	});

	test('respects a custom TRANSFER_HOLD_SLA_HOURS read at call time', async () => {
		process.env.TRANSFER_HOLD_SLA_HOURS = '1';
		const txn = makeTransaction({ hoursSinceCompletion: 2 }); // stuck under a 1h SLA
		mockFind([txn]);

		await runCheck();

		expect(notifyAllAdmins).toHaveBeenCalledTimes(1);
	});

	test('a notifyAllAdmins failure does not stop the sweep from saving the alert flag', async () => {
		notifyAllAdmins.mockRejectedValueOnce(new Error('push service down'));
		const txn = makeTransaction({ hoursSinceCompletion: 10 });
		mockFind([txn]);

		await runCheck();

		expect(txn.staleTransferAlertSentAt).toBeInstanceOf(Date);
		expect(txn.save).toHaveBeenCalled();
	});

	test('a query failure is caught and logged, never thrown', async () => {
		Transaction.find.mockImplementation(() => {
			throw new Error('DB unavailable');
		});

		await expect(runCheck()).resolves.toBeUndefined();
	});
});
