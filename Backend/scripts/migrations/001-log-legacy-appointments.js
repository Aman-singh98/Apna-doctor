// scripts/migrations/001-log-legacy-appointments.js
//
// Phase 1, task 8 — decide default behavior for pre-payment-integration
// Appointment records (they predate razorpayOrderId/paymentStatus, so those
// fields are simply `undefined` on read — no schema default is applied).
//
// This script is intentionally READ-ONLY. It does not set paymentStatus to
// 'paid' (or anything else) on legacy rows, because that would assert a
// payment that never happened through Razorpay. Instead it just reports how
// many such rows exist, so you can eyeball the number before relying on the
// "missing paymentStatus == legacy, treat as already-confirmed" rule that
// the rest of the codebase (controllers, admin UI) must follow.
//
// Run once, any time you want a fresh count:  node scripts/migrations/001-log-legacy-appointments.js

require('dotenv').config();
const connectDB = require('../../config/db');
const Appointment = require('../../models/Appointment');

(async () => {
	await connectDB();

	try {
		const legacyCount = await Appointment.countDocuments({
			paymentStatus: { $exists: false },
		});
		const totalCount = await Appointment.countDocuments({});

		console.log(`[Migration audit] ${legacyCount} of ${totalCount} Appointment(s) predate payment integration (no paymentStatus field).`);
		console.log('[Migration audit] No writes performed. These rows are treated as legacy/already-confirmed by convention — see models/Appointment.js.');
	} catch (err) {
		console.error('[Migration audit] Failed:', err.message);
		process.exitCode = 1;
	} finally {
		await require('mongoose').disconnect();
	}
})();
