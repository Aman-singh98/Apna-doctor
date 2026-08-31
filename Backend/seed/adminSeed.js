// ─── Admin Seed Script ────────────────────────────────────────────────────────
// Creates the initial superadmin account in MongoDB.
// Run ONCE before first launch:  node seed/adminSeed.js
//
// ⚠️  Change the credentials below (or set env vars) before running in production.
// ⚠️  Never commit real credentials to version control.
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

// ── Seed data — override via env vars ─────────────────────────────────────────
const SEED_ADMIN = {
	name: 'Super Admin',
	email: process.env.SEED_ADMIN_EMAIL || 'admin@apnadoctor.in',
	password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',   // min 8 chars
	role: 'superadmin',
	isActive: true,
};

const seed = async () => {
	await connectDB();

	try {
		// Check if superadmin already exists
		const existing = await Admin.findOne({ email: SEED_ADMIN.email });
		if (existing) {
			console.log(`[Seed] Admin already exists: ${existing.email}`);
			process.exit(0);
		}

		// Create the superadmin (password is hashed by the pre-save hook in Admin.js)
		const admin = await Admin.create(SEED_ADMIN);

		console.log(`[Seed] ✅ Superadmin created successfully!`);
		console.log(`       Email : ${admin.email}`);
		console.log(`       Role  : ${admin.role}`);
		console.log(`       ID    : ${admin._id}`);
		console.log(`\n[Seed] ⚠️  Store these credentials securely. Do NOT use default passwords in production.`);
	} catch (err) {
		console.error('[Seed] ❌ Error creating admin:', err.message);
	} finally {
		await mongoose.disconnect();
		process.exit(0);
	}
};

seed();
