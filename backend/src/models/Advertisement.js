// models/Advertisement.js
const mongoose = require('mongoose');

const statusEnum = [
  'DRAFT',
  'CHANGES_REQUIRED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
];

const advertisementSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  caption: { type: String },
  imageUrl: { type: String },
  brandGuideline: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BrandGuideline',
    required: function () { return this.isNew; },
  },
  status: { type: String, enum: statusEnum, default: 'DRAFT' },
  aiStatus: { type: String, enum: ['flagged', 'clean', 'unavailable'] },
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
