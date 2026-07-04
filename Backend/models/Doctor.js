const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
	{
		phone: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},

		// ── Profile fields (filled during signup) ─────────────────────────────
		name: { type: String, trim: true },
		qualification: { type: String },
		regNumber: { type: String },   // medical registration number
		hospital: { type: String },
		experience: { type: Number },
		specialization: { type: String },
		bio: { type: String },
		photoUrl: { type: String },
		photoPublicId: { type: String },

		// ── Consultation fees (set by doctor after approval) ───────────────────
		videoFee: { type: Number, default: 0 },
		chatFee: { type: Number, default: 0 },

		// ── Live app state ───────────────────────────────────────────────────
		available: { type: Boolean, default: true },
		rating: { type: Number, default: 0 },

		schedule: {
			// Defaults below match the "fresh doctor" experience in the app —
			// Mon-Fri, 4 standard slots/day, video+chat on, audio off, cap 12/day.
			activeDays: {
				type: [{ type: String }],
				default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
			},
			activeSlots: {
				type: [{ type: String }],
				default: ['09:00 AM', '10:00 AM', '03:00 PM', '04:00 PM'],
			},
			videoEnabled: { type: Boolean, default: true },
			audioEnabled: { type: Boolean, default: true },
			chatEnabled: { type: Boolean, default: true },
			maxPatients: { type: Number, default: 12 },
		},

		// ── Push notifications ───────────────────────────────────────────────
		fcmToken: { type: String },

		// ── Cloudinary document URLs ───────────────────────────────────────────
		documents: {
			medicalLicense: { url: String, publicId: String },
			idProof: { url: String, publicId: String },
		},

		// ── Onboarding / admin-review state ────────────────────────────────────
		// not_started: OTP verified, terms/signup not done yet
		// pending:     signup submitted, awaiting admin review
		// approved:    admin approved — doctor can go live in the app
		// rejected:    admin rejected signup documents
		// suspended:   admin temporarily disabled a previously-approved doctor
		approvalStatus: {
			type: String,
			enum: ['not_started', 'pending', 'approved', 'rejected', 'suspended'],
			default: 'not_started',
			index: true,
		},

		hasAcceptedTerms: { type: Boolean, default: false },
		termsAcceptedAt: { type: Date },

		rejectionReason: { type: String },
		suspensionReason: { type: String },
		signupCompletedAt: { type: Date },
		approvedAt: { type: Date },

		// ── Admin audit trail ───────────────────────────────────────────────────
		reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
		reviewedAt: { type: Date },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
