// models/PublishingRecord.js
const mongoose = require('mongoose');

const publishingRecordSchema = new mongoose.Schema({
  advertisementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertisement', required: true },
  platform: { type: String, enum: ['linkedin', 'instagram', 'facebook', 'x'], required: true },
  socialAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
  platformPostId: { type: String },
  status: { type: String, enum: ['PENDING', 'PUBLISHED', 'FAILED'], default: 'PENDING' },
  publishedAt: { type: Date },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PublishingRecord', publishingRecordSchema);
