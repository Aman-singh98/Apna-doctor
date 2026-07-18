const mongoose = require('mongoose');
const { DOCTOR_CATEGORY_KEYS, getFeesForCategory } = require('../config/doctorFeeConfig');

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

		// ── Signature (shown on prescriptions) ─────────────────────────────────
		signatureUrl: { type: String },
		signaturePublicId: { type: String },

		// ── Doctor category — decides consultation fees + revenue split ────────
		// Chosen once at signup (see doctor-signup.js on the frontend); can be
		// changed later from profile-edit.js. Whenever this changes, the
		// pre('save') hook below re-derives videoFee/audioFee/chatFee from
		// config/doctorFeeConfig.js — those fee fields should never be set
		// directly by a doctor or admin request.
		category: {
			type: String,
			enum: DOCTOR_CATEGORY_KEYS, // ['gp', 'specialist', 'super_specialist']
		},

		// ── Consultation fees — AUTO-DERIVED from `category`, read-only from
		// the doctor's perspective. Cached on the document (rather than only
		// computed on the fly) so any existing queries/aggregations that sort,
		// filter, or display doctor.videoFee etc. keep working unchanged.
		videoFee: { type: Number, default: 0 },
		audioFee: { type: Number, default: 0 },
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

		// ── Self-service account deletion (Settings > Danger Zone) ────────────────
		// active:           normal account
		// pending_deletion: doctor tapped "Delete Account", inside the grace period —
		//                    pulled off the bookable-doctors list, still logged in,
		//                    can cancel from Settings
		// deleted:          grace period passed, PII anonymized by the daily job
		//                    in jobs/accountDeletionJob.js. Document is NOT removed —
		//                    Appointments/Prescriptions/Reviews still reference this _id.
		accountStatus: {
			type: String,
			enum: ['active', 'pending_deletion', 'deleted'],
			default: 'active',
			index: true,
		},
		deletionRequestedAt: { type: Date },
		deletionScheduledAt: { type: Date }, // requestedAt + grace period
		deletedAt: { type: Date },

		// ── Admin audit trail ───────────────────────────────────────────────────
		reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
		reviewedAt: { type: Date },
	},
	{ timestamps: true }
);

// Auto-fill fees from category whenever category is set/changed.
// NOTE: this only fires on .save() — findByIdAndUpdate()/updateOne() skip
// document middleware by default. Controllers that change `category` must
// fetch the document and call .save() rather than findByIdAndUpdate.
doctorSchema.pre('save', function (next) {
	if (this.isModified('category') && this.category) {
		const fees = getFeesForCategory(this.category);
		this.videoFee = fees.video;
		this.audioFee = fees.audio;
		this.chatFee = fees.chat;
	}
	next();
});

module.exports = mongoose.model('Doctor', doctorSchema);
