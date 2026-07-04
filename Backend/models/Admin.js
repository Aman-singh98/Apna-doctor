// ─── Admin Model ──────────────────────────────────────────────────────────────
// Only superadmin accounts exist — created via seed script, never via API.
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Admin name is required'],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: 8,
      select:    false,   // never returned in queries by default
    },
    role: {
      type:    String,
      enum:    ['superadmin', 'admin'],
      default: 'admin',
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ── Hash password before save ─────────────────────────────────────────────────
adminSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt    = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Instance method: compare plain vs hashed ──────────────────────────────────
adminSchema.methods.matchPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
