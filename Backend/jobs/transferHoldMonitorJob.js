// jobs/transferHoldMonitorJob.js
//
// Phase 5, task 30: alert on any Route transfer stuck on_hold past a
// reasonable SLA after its consultation completed.
//
// In the normal flow a transfer is released synchronously in
// controllers/appointmentController.js completeAppointment (tasks 27-28)
// and independently confirmed shortly after by the transfer.processed
// webhook (Phase 4, task 24). A Transaction still onHold/pending a good
// while after Appointment.completedAt means one of those two paths never
// finished — the release call failed (see completeAppointment's
// 'consultation.complete.transfer_release_failed' security log), the
// webhook never arrived, or (rarer) there was never a transfer to release
// in the first place ('consultation.complete.no_transfer_to_release') —
// and needs a human to look at it via Phase 9's admin
// payments/reconciliation view.
//
// No extra dependency (no node-cron) — a setInterval sweep is enough for a
// single instance, same pattern as jobs/accountDeletionJob.js. If this
// scales to multiple server instances, swap for node-cron/agenda + a lock
// so the sweep (and its admin notifications) doesn't fire once per
// instance.
//
// Start once from server.js:
//   const { startTransferHoldMonitorJob } = require('./jobs/transferHoldMonitorJob');
//   startTransferHoldMonitorJob();

const Transaction = require('../models/Transaction');
const { TRANSACTION_STATUS } = require('../constants/paymentConstants');
const { logSecurityEvent } = require('../utils/paymentLogger');
const { notifyAllAdmins } = require('../utils/notify');

const ONE_HOUR_MS = 60 * 60 * 1000;
const CHECK_INTERVAL_MS = ONE_HOUR_MS; // hourly sweep

// How long a transfer may sit on_hold after the consultation completed
// before it counts as "stuck." Configurable since what's "reasonable"
// depends on Razorpay settlement latency in practice; 6h comfortably
// clears normal webhook/settlement delay while still catching a real
// problem same-day rather than a day later. Read per-call (not cached at
// module load) so it responds to the env var immediately, no restart
// needed, and so it can be exercised in tests without reloading modules.
function getStuckOnHoldSlaMs() {
	return Number(process.env.TRANSFER_HOLD_SLA_HOURS || 6) * ONE_HOUR_MS;
}

// Once a Transaction has been flagged, don't re-alert on every hourly
// sweep — that would spam admins for a single still-unresolved case.
// Re-alert once a day instead: frequent enough that an ignored alert
// doesn't go silent, infrequent enough not to be noise.
const REALERT_INTERVAL_MS = 24 * ONE_HOUR_MS;

/**
 * Finds Transactions whose Route transfer is still on_hold/pending well
 * after the linked Appointment completed, and that haven't been alerted on
 * (or are due for a re-alert).
 */
async function findStuckTransfers() {
	const cutoff = new Date(Date.now() - getStuckOnHoldSlaMs());
	const realertCutoff = new Date(Date.now() - REALERT_INTERVAL_MS);

	// Scope to transactions that actually have a transfer to be stuck in
	// the first place — one with no razorpayTransferId at all is already
	// flagged separately at completion time
	// ('consultation.complete.no_transfer_to_release') and is Phase 9's
	// admin-payout problem, not a "stuck transfer" one.
	const candidates = await Transaction.find({
		onHold: true,
		status: TRANSACTION_STATUS.PENDING,
		razorpayTransferId: { $exists: true, $ne: null },
	}).populate('appointment');

	return candidates.filter((txn) => {
		const appt = txn.appointment;
		if (!appt || appt.status !== 'completed' || !appt.completedAt) return false;
		if (appt.completedAt > cutoff) return false; // not stuck long enough yet

		if (txn.staleTransferAlertSentAt && txn.staleTransferAlertSentAt > realertCutoff) {
			return false; // already alerted recently, not due for a re-alert
		}
		return true;
	});
}

async function runCheck() {
	try {
		const stuck = await findStuckTransfers();

		for (const txn of stuck) {
			const appt = txn.appointment;
			const ageHours = Math.floor((Date.now() - appt.completedAt.getTime()) / ONE_HOUR_MS);

			logSecurityEvent(
				'monitor.transfer_stuck_on_hold',
				{
					transactionId: String(txn._id),
					transferId: txn.razorpayTransferId,
					appointmentId: String(appt._id),
				},
				{ doctorId: String(txn.doctor), ageHours }
			);

			// Best-effort, same semantics as every other notify()/notifyAllAdmins()
			// call site in this codebase — a push/notification failure must
			// never stop the sweep from flagging the rest.
			await notifyAllAdmins({
				type: 'payment_alert',
				title: 'Route transfer stuck on hold',
				desc: `A doctor payout has been on_hold for ${ageHours}h since consultation completion (transaction ${txn._id}) — needs manual reconciliation.`,
				meta: {
					transactionId: String(txn._id),
					appointmentId: String(appt._id),
					transferId: txn.razorpayTransferId,
				},
			}).catch((err) => {
				logSecurityEvent(
					'monitor.transfer_stuck_on_hold.notify_failed',
					{ transactionId: String(txn._id) },
					{ message: err.message }
				);
			});

			txn.staleTransferAlertSentAt = new Date();
			await txn.save();
		}

		if (stuck.length) {
			console.log(`[TransferHoldMonitorJob] Flagged ${stuck.length} stuck transfer(s).`);
		}
	} catch (err) {
		console.error('[TransferHoldMonitorJob] Check failed:', err);
	}
}

function startTransferHoldMonitorJob() {
	runCheck(); // also run once at boot, same rationale as accountDeletionJob
	setInterval(runCheck, CHECK_INTERVAL_MS);
}

module.exports = { startTransferHoldMonitorJob, runCheck, getStuckOnHoldSlaMs };
