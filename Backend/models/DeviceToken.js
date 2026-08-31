const mongoose = require('mongoose');

// Kept as its own collection instead of a field on User/Doctor so we don't
// have to touch your existing schema. One user can have multiple tokens
// (multiple devices) — upsert on (userId, token).
const deviceTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], default: 'android' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
