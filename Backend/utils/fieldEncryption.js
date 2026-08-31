// utils/fieldEncryption.js
//
// Field-level encryption for financial/PII data that must be encrypted at
// rest per the payments security standard (PAN, bank account number, UPI
// ID — see Phase 3, task 18). AES-256-GCM: authenticated encryption, so a
// tampered ciphertext fails to decrypt instead of silently returning
// garbage.
//
// Storage format: base64( iv(12 bytes) | authTag(16 bytes) | ciphertext ),
// a single opaque string per field — easy to store in one Mongo field, no
// separate iv/authTag columns to keep in sync.
//
// SECURITY:
//   - The key (PAYOUT_KYC_ENCRYPTION_KEY) lives in env/secrets manager only,
//     same as RAZORPAY_KEY_SECRET — never committed, never logged.
//   - encryptField/decryptField never log their input or output. Callers
//     must not pass the plaintext or ciphertext to paymentLogger — only
//     reference ids (doctorId, razorpayAccountId) and masked display values
//     (see maskLast4 / maskUpi below).
//   - Rotating the key requires re-encrypting existing rows; this module
//     intentionally does not support multiple key versions yet — flagged
//     here for whoever picks that up later.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV, recommended size for GCM
const AUTH_TAG_LENGTH = 16;

function getKey() {
	const keyHex = process.env.PAYOUT_KYC_ENCRYPTION_KEY;
	if (!keyHex) {
		throw new Error(
			'PAYOUT_KYC_ENCRYPTION_KEY is not set. Add a 64-character hex string (32 bytes) to Backend/.env — ' +
				'generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
		);
	}
	const key = Buffer.from(keyHex, 'hex');
	if (key.length !== 32) {
		throw new Error('PAYOUT_KYC_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters) for AES-256-GCM.');
	}
	return key;
}

/**
 * Encrypt a plaintext value for storage. Returns undefined for
 * null/undefined/empty input so callers can do `field: encryptField(x)`
 * without writing an empty/garbage ciphertext when x wasn't provided.
 */
function encryptField(plaintext) {
	if (plaintext === undefined || plaintext === null || plaintext === '') return undefined;
	const key = getKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Decrypt a value previously produced by encryptField. Throws if the
 * payload has been tampered with (GCM auth tag mismatch) rather than
 * returning corrupted plaintext.
 */
function decryptField(payload) {
	if (!payload) return null;
	const key = getKey();
	const raw = Buffer.from(payload, 'base64');
	const iv = raw.subarray(0, IV_LENGTH);
	const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return plaintext.toString('utf8');
}

/**
 * Masked display value for logs/UI — last 4 characters only, e.g. for a
 * PAN or bank account number. Never put the un-masked value in a log line.
 */
function maskLast4(plaintext) {
	if (!plaintext) return '';
	const str = String(plaintext);
	if (str.length <= 4) return '*'.repeat(str.length);
	return '*'.repeat(str.length - 4) + str.slice(-4);
}

/**
 * Masked display value for a UPI VPA (name@bank) — keeps the bank handle
 * (not sensitive on its own) and masks the handle/account portion.
 */
function maskUpi(vpa) {
	if (!vpa || typeof vpa !== 'string' || !vpa.includes('@')) return '';
	const [handle, bank] = vpa.split('@');
	const maskedHandle = handle.length <= 2 ? '*'.repeat(handle.length) : handle[0] + '*'.repeat(handle.length - 2) + handle.slice(-1);
	return `${maskedHandle}@${bank}`;
}

module.exports = { encryptField, decryptField, maskLast4, maskUpi };
