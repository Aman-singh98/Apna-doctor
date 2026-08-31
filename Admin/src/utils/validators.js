// Reusable, framework-agnostic validators. Keep these pure so they can be
// unit-tested without touching React.

export const REASON_MIN_LENGTH = 30;

/**
 * Validates a free-text "reason" field (used for reject / suspend flows,
 * and anywhere else in the app that asks an admin to justify an action).
 *
 * @param {string} value - raw textarea value
 * @param {number} [minLength] - minimum trimmed length required
 * @returns {string|null} an error message, or null when valid
 */
export const validateReason = (value, minLength = REASON_MIN_LENGTH) => {
	const trimmed = (value ?? '').trim();

	if (!trimmed) {
		return 'Please enter a reason before confirming.';
	}
	if (trimmed.length < minLength) {
		return `Reason must be at least ${minLength} characters (currently ${trimmed.length}).`;
	}
	return null;
};