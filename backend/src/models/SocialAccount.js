// backend/src/models/SocialAccount.js
const mongoose = require('mongoose');

const socialAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // employee or admin who connected
  platform: { type: String, enum: ['linkedin', 'instagram', 'facebook', 'x'], required: true },
  platformUserId: { type: String, required: true },
  accountName: { type: String },
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  tokenExpiresAt: { type: Date },
  connectedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SocialAccount', socialAccountSchema);
