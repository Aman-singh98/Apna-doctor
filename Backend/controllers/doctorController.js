const Doctor = require('../models/Doctor');
const { notify } = require('../utils/notify');
const { anonymizeDoctor } = require('../jobs/accountDeletionJob');
const { provisionPayoutAccount, PayoutProvisioningError } = require('../services/doctorPayoutService');

// GET /api/doctors — status: pending|approved|rejected|suspended, search, page, limit
// accountStatus: active|pending_deletion|deleted — separate dimension from
// approvalStatus, since a doctor can be mid-deletion while still 'approved'.
const getAllDoctors = async (req, res, next) => {
	try {
		const { status, search, accountStatus, category, page = 1, limit = 10 } = req.query;

		// Default view excludes 'not_started' — those doctors haven't submitted
		// anything for review yet, so they shouldn't clutter the admin queue.
		const filter = { approvalStatus: { $ne: 'not_started' } };
		if (status) filter.approvalStatus = status;
		if (accountStatus) filter.accountStatus = accountStatus;
		if (category) filter.category = category; // 'gp' | 'specialist' | 'super_specialist'

		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ specialization: { $regex: search, $options: 'i' } },
				{ regNumber: { $regex: search, $options: 'i' } },
			];
		}

		const skip = (Number(page) - 1) * Number(limit);
		const total = await Doctor.countDocuments(filter);

		const doctors = await Doctor.find(filter)
			.select('-documents')
			.populate('reviewedBy', 'name email')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(Number(limit));

		res.status(200).json({
			success: true,
			total,
			page: Number(page),
			pages: Math.ceil(total / Number(limit)),
			doctors,
		});
	} catch (err) {
		next(err);
	}
};

// GET /api/doctors/stats
const getDoctorStats = async (req, res, next) => {
	try {
		const stats = await Doctor.aggregate([
			{ $match: { approvalStatus: { $ne: 'not_started' } } },
			{ $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
		]);

		const result = { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 };
		stats.forEach(({ _id, count }) => {
			result[_id] = count;
			result.total += count;
		});

		const [pendingDeletion, deleted] = await Promise.all([
			Doctor.countDocuments({ accountStatus: 'pending_deletion' }),
			Doctor.countDocuments({ accountStatus: 'deleted' }),
		]);
		result.pendingDeletion = pendingDeletion;
		result.deleted = deleted;

		// Category breakdown — e.g. { gp: 12, specialist: 8, super_specialist: 3 }
		// Only counts doctors who've actually submitted (excludes not_started),
		// mirroring the same base filter as the status breakdown above.
		const categoryStats = await Doctor.aggregate([
			{ $match: { approvalStatus: { $ne: 'not_started' }, category: { $ne: null } } },
			{ $group: { _id: '$category', count: { $sum: 1 } } },
		]);
		result.byCategory = categoryStats.reduce((acc, { _id, count }) => {
			acc[_id] = count;
			return acc;
		}, {});

		res.status(200).json({ success: true, stats: result });
	} catch (err) {
		next(err);
	}
};

// GET /api/doctors/:id
const getDoctorById = async (req, res, next) => {
	try {
		const doctor = await Doctor.findById(req.params.id).populate('reviewedBy', 'name email');
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		res.status(200).json({ success: true, doctor });
	} catch (err) {
		next(err);
	}
};

// PATCH /api/doctors/:id/verify
const verifyDoctor = async (req, res, next) => {
	try {
		const doctor = await Doctor.findById(req.params.id);
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		if (doctor.approvalStatus === 'approved') {
			return res.status(400).json({ success: false, message: 'Doctor is already approved.' });
		}

		doctor.approvalStatus = 'approved';
		doctor.rejectionReason = '';
		doctor.approvedAt = new Date();
		doctor.reviewedBy = req.admin.id;
		doctor.reviewedAt = new Date();
		await doctor.save();

		await notify({
			recipientId: doctor._id,
			recipientRole: 'doctor',
			type: 'system',
			title: '🎉 Profile Verified!',
			desc: 'Congratulations! Your profile has been approved. You can now start accepting consultations.',
			meta: { doctorId: doctor._id },
		});

		// Phase 3, tasks 17-18: best-effort Route linked-account creation on
		// approval. Deliberately best-effort — a Razorpay/KYC problem here
		// must never undo or block the approval decision itself. If it fails
		// (e.g. doctor hasn't submitted PAN/bank/UPI yet), payoutStatus just
		// stays 'not_started' and an admin can retry later via
		// POST /api/doctors/:id/payout-account (see retryDoctorPayoutAccount).
		let payoutProvisioning = { attempted: true, status: 'skipped', payoutStatus: doctor.payoutStatus };
		try {
			const result = await provisionPayoutAccount(doctor._id);
			payoutProvisioning = { attempted: true, ...result };
		} catch (payoutErr) {
			payoutProvisioning = {
				attempted: true,
				status: 'failed',
				payoutStatus: doctor.payoutStatus,
				reason: payoutErr instanceof PayoutProvisioningError ? payoutErr.code : 'UNKNOWN_ERROR',
			};
		}

		res.status(200).json({
			success: true,
			message: `Dr. ${doctor.name} has been verified successfully.`,
			doctor: { id: doctor._id, name: doctor.name, approvalStatus: doctor.approvalStatus },
			payoutProvisioning,
		});
	} catch (err) {
		next(err);
	}
};

// POST /api/doctors/:id/payout-account
// Manually (re)trigger Razorpay Route linked-account creation — for when
// the automatic attempt during /verify failed (most commonly because the
// doctor hadn't submitted payout KYC yet) or the doctor updated their KYC
// details after a rejection. Idempotent: no-ops if already active/pending.
const createDoctorPayoutAccount = async (req, res, next) => {
	try {
		const doctor = await Doctor.findById(req.params.id).select('approvalStatus name');
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		if (doctor.approvalStatus !== 'approved') {
			return res.status(400).json({
				success: false,
				message: 'Doctor must be approved before a payout account can be created.',
			});
		}

		const result = await provisionPayoutAccount(req.params.id);
		res.status(200).json({ success: true, ...result });
	} catch (err) {
		if (err instanceof PayoutProvisioningError) {
			const status = err.code === 'DOCTOR_NOT_FOUND' ? 404 : err.code === 'KYC_INCOMPLETE' ? 400 : 502;
			return res.status(status).json({ success: false, code: err.code, message: err.message });
		}
		next(err);
	}
};

// PATCH /api/doctors/:id/reject
const rejectDoctor = async (req, res, next) => {
	try {
		const { reason } = req.body;
		if (!reason || !reason.trim()) {
			return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
		}

		const doctor = await Doctor.findById(req.params.id);
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		if (doctor.approvalStatus === 'rejected') {
			return res.status(400).json({ success: false, message: 'Doctor is already rejected.' });
		}

		doctor.approvalStatus = 'rejected';
		doctor.rejectionReason = reason.trim();
		doctor.reviewedBy = req.admin.id;
		doctor.reviewedAt = new Date();
		await doctor.save();

		await notify({
			recipientId: doctor._id,
			recipientRole: 'doctor',
			type: 'system',
			title: '❌ Verification Unsuccessful',
			desc: `Your profile verification was unsuccessful. Reason: ${reason.trim()}. Please re-upload your documents.`,
			meta: { doctorId: doctor._id },
		});

		res.status(200).json({
			success: true,
			message: `Dr. ${doctor.name} has been rejected.`,
			doctor: {
				id: doctor._id, name: doctor.name,
				approvalStatus: doctor.approvalStatus,
				rejectionReason: doctor.rejectionReason,
			},
		});
	} catch (err) {
		next(err);
	}
};

// PATCH /api/doctors/:id/suspend
const suspendDoctor = async (req, res, next) => {
	try {
		const { reason } = req.body;
		if (!reason || !reason.trim()) {
			return res.status(400).json({ success: false, message: 'A suspension reason is required.' });
		}

		const doctor = await Doctor.findById(req.params.id);
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		if (doctor.approvalStatus !== 'approved') {
			return res.status(400).json({ success: false, message: 'Only an approved doctor can be suspended.' });
		}

		doctor.approvalStatus = 'suspended';
		doctor.suspensionReason = reason.trim();
		doctor.reviewedBy = req.admin.id;
		doctor.reviewedAt = new Date();
		await doctor.save();

		await notify({
			recipientId: doctor._id,
			recipientRole: 'doctor',
			type: 'system',
			title: '⚠️ Account Suspended',
			desc: `Your account has been temporarily suspended. Reason: ${reason.trim()}. Contact support for assistance.`,
			meta: { doctorId: doctor._id },
		});

		res.status(200).json({
			success: true,
			message: `Dr. ${doctor.name} has been suspended.`,
			doctor: { id: doctor._id, name: doctor.name, approvalStatus: doctor.approvalStatus },
		});
	} catch (err) {
		next(err);
	}
};

// PATCH /api/doctors/:id/unsuspend
const unsuspendDoctor = async (req, res, next) => {
	try {
		const doctor = await Doctor.findById(req.params.id);
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		if (doctor.approvalStatus !== 'suspended') {
			return res.status(400).json({ success: false, message: 'Doctor is not currently suspended.' });
		}

		doctor.approvalStatus = 'approved';
		doctor.suspensionReason = '';
		doctor.reviewedBy = req.admin.id;
		doctor.reviewedAt = new Date();
		await doctor.save();

		await notify({
			recipientId: doctor._id,
			recipientRole: 'doctor',
			type: 'system',
			title: '✅ Account Reactivated',
			desc: 'Your account suspension has been lifted. You can now resume accepting consultations.',
			meta: { doctorId: doctor._id },
		});

		res.status(200).json({
			success: true,
			message: `Dr. ${doctor.name}'s account has been reactivated.`,
			doctor: { id: doctor._id, name: doctor.name, approvalStatus: doctor.approvalStatus },
		});
	} catch (err) {
		next(err);
	}
};

// PATCH /api/doctors/:id/cancel-deletion
// Admin override of the self-service "cancel deletion" (controllers/
// accountDeletionController.js:cancelDoctorDeletion) — e.g. doctor asked
// support to undo it for them.
const cancelDoctorDeletion = async (req, res, next) => {
	try {
		const doctor = await Doctor.findById(req.params.id);
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		if (doctor.accountStatus !== 'pending_deletion') {
			return res.status(400).json({
				success: false,
				message: 'This doctor does not have a scheduled deletion to cancel.',
			});
		}

		doctor.accountStatus = 'active';
		doctor.deletionRequestedAt = undefined;
		doctor.deletionScheduledAt = undefined;
		doctor.available = true;
		doctor.reviewedBy = req.admin.id;
		doctor.reviewedAt = new Date();
		await doctor.save();

		await notify({
			recipientId: doctor._id,
			recipientRole: 'doctor',
			type: 'system',
			title: '✅ Account Deletion Cancelled',
			desc: 'Our support team has cancelled your scheduled account deletion. Welcome back!',
			meta: { doctorId: doctor._id },
		});

		res.status(200).json({
			success: true,
			message: `Dr. ${doctor.name}'s scheduled deletion has been cancelled.`,
			doctor,
		});
	} catch (err) {
		next(err);
	}
};

// PATCH /api/doctors/:id/finalize-deletion
// Skips the remaining grace period and anonymizes the account immediately.
// Only allowed on accounts already in pending_deletion.
const finalizeDoctorDeletionNow = async (req, res, next) => {
	try {
		const doctor = await Doctor.findById(req.params.id);
		if (!doctor) {
			return res.status(404).json({ success: false, message: 'Doctor not found.' });
		}
		if (doctor.accountStatus !== 'pending_deletion') {
			return res.status(400).json({
				success: false,
				message: 'Only accounts with a pending deletion request can be finalized early.',
			});
		}

		const name = doctor.name;
		await anonymizeDoctor(doctor);

		res.status(200).json({
			success: true,
			message: `Dr. ${name}'s account has been permanently deleted.`,
			doctor,
		});
	} catch (err) {
		next(err);
	}
};

module.exports = {
	getAllDoctors, getDoctorStats, getDoctorById,
	verifyDoctor, rejectDoctor, suspendDoctor, unsuspendDoctor,
	cancelDoctorDeletion, finalizeDoctorDeletionNow,
	createDoctorPayoutAccount,
};
