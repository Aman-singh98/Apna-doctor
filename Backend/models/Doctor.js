const mongoose = require('mongoose');
const { DOCTOR_CATEGORY_KEYS, getFeesForCategory } = require('../config/doctorFeeConfig');
const { PAYOUT_STATUS, PAYOUT_STATUS_VALUES } = require('../constants/paymentConstants');
const { encryptField, decryptField, maskLast4, maskUpi } = require('../utils/fieldEncryption');

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

		// ── Razorpay Route payout onboarding (Phase 3) ─────────────────────────
		// Set once the doctor's Route linked account is created on admin
		// approval. PAN/bank/UPI KYC fields themselves are added in Phase 3
		// (doctor-signup.js) and must be encrypted at rest — not stored here
		// until that field-level encryption is in place.
		razorpayAccountId: { type: String, select: false },
		payoutStatus: {
			type: String,
			enum: PAYOUT_STATUS_VALUES,
			default: PAYOUT_STATUS.NOT_STARTED,
			index: true,
		},

		// ── Payout KYC (Phase 3, task 18) ───────────────────────────────────
		// PAN / bank account / UPI are financial PII: encrypted at rest with
		// AES-256-GCM (utils/fieldEncryption.js), `select: false` so a normal
		// Doctor.find()/findById() NEVER returns these fields — not even the
		// ciphertext — unless a caller explicitly opts in with
		// `.select('+payoutKyc.panEncrypted')` (see findByIdWithPayoutKyc
		// below, which is the only place in this codebase that should do so).
		// Use setPayoutKyc()/getDecryptedPayoutKyc() below rather than
		// reading/writing these sub-fields directly — that keeps the
		// encrypt/decrypt/mask logic in one place.
		//
		// NOTE: `businessType` values here should mirror whatever Razorpay's
		// account-creation API expects (e.g. 'individual', 'proprietorship') —
		// double-check against current Razorpay Route docs before wiring the
		// doctor-app signup form (Phase 3, task 19) that populates this.
		payoutKyc: {
			panEncrypted: { type: String, select: false },
			panLast4: { type: String, select: false }, // display-only, e.g. "*******890F"

			bankAccountEncrypted: { type: String, select: false },
			bankAccountLast4: { type: String, select: false },

			// IFSC is a public bank-branch code, not secret on its own — but
			// select:false anyway to minimize exposure since it's only useful
			// paired with the (encrypted) account number.
			ifscCode: { type: String, select: false },

			upiIdEncrypted: { type: String, select: false },
			upiIdMasked: { type: String, select: false }, // e.g. "d***r@okhdfcbank"

			legalBusinessName: { type: String, select: false },
			businessType: { type: String, select: false },

			// Doctor.phone is used for OTP login and isn't necessarily a good
			// contact channel for Razorpay's KYC/settlement communication, and
			// there's no `email` field on the doctor account today — so payout
			// onboarding collects its own contact email here.
			contactEmail: { type: String, select: false },

			kycSubmittedAt: { type: Date, select: false },
		},
	},
	{ timestamps: true }
);

// Auto-fill fees from category whenever category is set/changed.
// NOTE: this only fires on .save() — findByIdAndUpdate()/updateOne() skip
// document middleware by default. Controllers that change `category` must
// fetch the document and call .save() rather than findByIdAndUpdate.
doctorSchema.pre('save', async function () {
	if (this.isModified('category') && this.category) {
		const fees = getFeesForCategory(this.category);
		this.videoFee = fees.video;
		this.audioFee = fees.audio;
		this.chatFee = fees.chat;
	}
});

// Encrypt + store payout KYC fields on this (already-fetched) document.
// Caller must still call .save(). Never logs or returns the plaintext.
doctorSchema.methods.setPayoutKyc = function setPayoutKyc({
	pan,
	bankAccountNumber,
	ifscCode,
	upiId,
	legalBusinessName,
	businessType,
	contactEmail,
} = {}) {
	this.payoutKyc = this.payoutKyc || {};

	if (contactEmail) this.payoutKyc.contactEmail = String(contactEmail).trim().toLowerCase();

	if (pan) {
		const normalizedPan = String(pan).toUpperCase().trim();
		this.payoutKyc.panEncrypted = encryptField(normalizedPan);
		this.payoutKyc.panLast4 = maskLast4(normalizedPan);
	}
	if (bankAccountNumber) {
		const normalizedAccount = String(bankAccountNumber).trim();
		this.payoutKyc.bankAccountEncrypted = encryptField(normalizedAccount);
		this.payoutKyc.bankAccountLast4 = maskLast4(normalizedAccount);
	}
	if (ifscCode) {
		this.payoutKyc.ifscCode = String(ifscCode).toUpperCase().trim();
	}
	if (upiId) {
		const normalizedUpi = String(upiId).trim();
		this.payoutKyc.upiIdEncrypted = encryptField(normalizedUpi);
		this.payoutKyc.upiIdMasked = maskUpi(normalizedUpi);
	}
	if (legalBusinessName) this.payoutKyc.legalBusinessName = String(legalBusinessName).trim();
	if (businessType) this.payoutKyc.businessType = String(businessType).trim();

	this.payoutKyc.kycSubmittedAt = new Date();
};

// Decrypt payout KYC fields for one-time use (building the Razorpay linked
// account payload). Only call this on a document fetched via
// findByIdWithPayoutKyc — on a normal find()/findById() these fields are
// undefined (select: false) and this will just return nulls.
doctorSchema.methods.getDecryptedPayoutKyc = function getDecryptedPayoutKyc() {
	const kyc = this.payoutKyc || {};
	return {
		pan: kyc.panEncrypted ? decryptField(kyc.panEncrypted) : null,
		bankAccountNumber: kyc.bankAccountEncrypted ? decryptField(kyc.bankAccountEncrypted) : null,
		ifscCode: kyc.ifscCode || null,
		upiId: kyc.upiIdEncrypted ? decryptField(kyc.upiIdEncrypted) : null,
		legalBusinessName: kyc.legalBusinessName || null,
		businessType: kyc.businessType || null,
		contactEmail: kyc.contactEmail || null,
		submittedAt: kyc.kycSubmittedAt || null,
	};
};

// Whether enough KYC has been submitted to attempt Route account creation.
// (PAN + business identity + contact email + at least one payout
// destination — bank or UPI.)
doctorSchema.methods.hasSubmittedPayoutKyc = function hasSubmittedPayoutKyc() {
	const kyc = this.payoutKyc || {};
	const hasPayoutDestination = Boolean(kyc.bankAccountEncrypted && kyc.ifscCode) || Boolean(kyc.upiIdEncrypted);
	return Boolean(
		kyc.panEncrypted && kyc.legalBusinessName && kyc.businessType && kyc.contactEmail && hasPayoutDestination
	);
};

// The ONLY place in the codebase that should pull payoutKyc's encrypted
// fields out of the database — used right before calling Razorpay to
// create the linked account. Every other read of a Doctor document keeps
// these fields excluded by default.
doctorSchema.statics.findByIdWithPayoutKyc = function findByIdWithPayoutKyc(id) {
	return this.findById(id).select(
		'+razorpayAccountId +payoutKyc.panEncrypted +payoutKyc.panLast4 +payoutKyc.bankAccountEncrypted ' +
			'+payoutKyc.bankAccountLast4 +payoutKyc.ifscCode +payoutKyc.upiIdEncrypted +payoutKyc.upiIdMasked ' +
			'+payoutKyc.legalBusinessName +payoutKyc.businessType +payoutKyc.contactEmail +payoutKyc.kycSubmittedAt'
	);
};

// Look up a doctor by their Razorpay Route linked-account id — used by the
// webhook handler (Phase 3, task 20) to resolve `account.*` KYC events back
// to a Doctor document. razorpayAccountId is `select: false` on normal
// queries, so a plain `Doctor.findOne({ razorpayAccountId })` would never
// match; this explicitly opts it back in.
doctorSchema.statics.findByRazorpayAccountId = function findByRazorpayAccountId(razorpayAccountId) {
	return this.findOne({ razorpayAccountId }).select('+razorpayAccountId');
};

module.exports = mongoose.model('Doctor', doctorSchema);
