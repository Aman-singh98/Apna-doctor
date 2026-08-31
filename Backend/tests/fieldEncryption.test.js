// tests/fieldEncryption.test.js
//
// Phase 3, task 18: "Ensure PAN/bank fields are encrypted at rest." These
// tests target the encryption boundary itself — a round trip must recover
// the exact plaintext, a tampered ciphertext must fail loudly (not decrypt
// to garbage), and the masking helpers used for display/logs must never
// leak the full value.

process.env.PAYOUT_KYC_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes of 0xaa, test-only

const { encryptField, decryptField, maskLast4, maskUpi } = require('../utils/fieldEncryption');

describe('fieldEncryption.encryptField / decryptField', () => {
	test('round-trips a PAN value exactly', () => {
		const pan = 'ABCDE1234F';
		const encrypted = encryptField(pan);
		expect(encrypted).not.toBe(pan);
		expect(decryptField(encrypted)).toBe(pan);
	});

	test('round-trips a bank account number exactly', () => {
		const account = '123456789012';
		const encrypted = encryptField(account);
		expect(decryptField(encrypted)).toBe(account);
	});

	test('produces a different ciphertext each time (random IV) even for the same input', () => {
		const a = encryptField('ABCDE1234F');
		const b = encryptField('ABCDE1234F');
		expect(a).not.toBe(b);
		expect(decryptField(a)).toBe(decryptField(b));
	});

	test('returns undefined for empty/null/undefined input instead of encrypting garbage', () => {
		expect(encryptField(undefined)).toBeUndefined();
		expect(encryptField(null)).toBeUndefined();
		expect(encryptField('')).toBeUndefined();
	});

	test('returns null when decrypting a falsy payload', () => {
		expect(decryptField(undefined)).toBeNull();
		expect(decryptField(null)).toBeNull();
		expect(decryptField('')).toBeNull();
	});

	test('throws rather than returning corrupted plaintext when ciphertext is tampered with', () => {
		const encrypted = encryptField('ABCDE1234F');
		const raw = Buffer.from(encrypted, 'base64');
		raw[raw.length - 1] ^= 0xff; // flip a byte in the ciphertext
		const tampered = raw.toString('base64');

		expect(() => decryptField(tampered)).toThrow();
	});

	test('throws a clear error when the encryption key env var is missing', () => {
		const original = process.env.PAYOUT_KYC_ENCRYPTION_KEY;
		delete process.env.PAYOUT_KYC_ENCRYPTION_KEY;
		try {
			expect(() => encryptField('ABCDE1234F')).toThrow(/PAYOUT_KYC_ENCRYPTION_KEY/);
		} finally {
			process.env.PAYOUT_KYC_ENCRYPTION_KEY = original;
		}
	});

	test('throws when the key is not exactly 32 bytes', () => {
		const original = process.env.PAYOUT_KYC_ENCRYPTION_KEY;
		process.env.PAYOUT_KYC_ENCRYPTION_KEY = 'abcd'; // way too short
		try {
			expect(() => encryptField('ABCDE1234F')).toThrow(/32 bytes/);
		} finally {
			process.env.PAYOUT_KYC_ENCRYPTION_KEY = original;
		}
	});
});

describe('fieldEncryption.maskLast4', () => {
	test('masks all but the last 4 characters', () => {
		expect(maskLast4('ABCDE1234F')).toBe('******234F');
		expect(maskLast4('123456789012')).toBe('********9012');
	});

	test('masks the whole value when 4 characters or shorter', () => {
		expect(maskLast4('AB12')).toBe('****');
		expect(maskLast4('A')).toBe('*');
	});

	test('returns empty string for falsy input', () => {
		expect(maskLast4('')).toBe('');
		expect(maskLast4(null)).toBe('');
		expect(maskLast4(undefined)).toBe('');
	});
});

describe('fieldEncryption.maskUpi', () => {
	test('masks the handle but keeps the bank suffix visible', () => {
		expect(maskUpi('doctor@okhdfcbank')).toBe('d****r@okhdfcbank');
	});

	test('masks very short handles entirely', () => {
		expect(maskUpi('ab@ybl')).toBe('**@ybl');
	});

	test('returns empty string for a non-VPA-shaped input', () => {
		expect(maskUpi('not-a-vpa')).toBe('');
		expect(maskUpi('')).toBe('');
		expect(maskUpi(null)).toBe('');
	});
});
