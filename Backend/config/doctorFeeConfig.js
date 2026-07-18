// config/doctorFeeConfig.js
//
// Backend mirror of the mobile app's constants/doctorFees.js.
// ⚠️ Keep these two files in sync manually — if you change a price or add
// a category here, update the frontend file too (and vice versa).
//
// This is the single source of truth the SERVER uses to auto-fill a
// doctor's videoFee / audioFee / chatFee whenever their `category` is
// set or changed. Doctors and admins never set fee amounts directly.

const DOCTOR_FEE_CONFIG = {
	gp: {
		label: 'MBBS (General Physician)',
		splitDoctor: 70,
		splitPlatform: 30,
		fees: { video: 399, audio: 299, chat: 199 },
	},
	specialist: {
		label: 'Specialist (MD)',
		splitDoctor: 75,
		splitPlatform: 25,
		fees: { video: 599, audio: 499, chat: 299 },
	},
	super_specialist: {
		label: 'Super Specialist (MBBS / MD / DM)',
		splitDoctor: 80,
		splitPlatform: 20,
		fees: { video: 999, audio: 799, chat: 599 },
	},
};

const DOCTOR_CATEGORY_KEYS = Object.keys(DOCTOR_FEE_CONFIG); // ['gp','specialist','super_specialist']

function getFeesForCategory(category) {
	const entry = DOCTOR_FEE_CONFIG[category];
	return entry ? entry.fees : { video: 0, audio: 0, chat: 0 };
}

function getSplitForCategory(category) {
	const entry = DOCTOR_FEE_CONFIG[category];
	return entry ? { doctor: entry.splitDoctor, platform: entry.splitPlatform } : null;
}

function getLabelForCategory(category) {
	const entry = DOCTOR_FEE_CONFIG[category];
	return entry ? entry.label : '';
}

module.exports = {
	DOCTOR_FEE_CONFIG,
	DOCTOR_CATEGORY_KEYS,
	getFeesForCategory,
	getSplitForCategory,
	getLabelForCategory,
};
