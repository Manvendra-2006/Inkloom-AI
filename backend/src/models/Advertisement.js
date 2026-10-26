// models/Advertisement.js
const mongoose = require('mongoose');

const statusEnum = [
  'DRAFT',
  'AI_CHECKED',
  'CHANGES_REQUIRED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'flagged'
];

const advertisementSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  caption: { type: String },
  imageUrl: { type: String },
  status: { type: String, enum: statusEnum, default: 'DRAFT' },
  aiComplianceScore: { type: Number },
  aiComplianceScore: { type: Number },
  aiCheckedAt: { type: Date },
  aiReport: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceReport' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

advertisementSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Advertisement', advertisementSchema);
