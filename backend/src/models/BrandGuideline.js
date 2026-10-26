// models/BrandGuideline.js
const mongoose = require('mongoose');

const categoryEnum = [
  'TONE',
  'TERMINOLOGY',
  'FACTS',
  'CLAIMS',
  'MESSAGING',
  'RESTRICTED_WORDS',
  'BRANDING',
  'ACCESSIBILITY',
];

const brandGuidelineSchema = new mongoose.Schema({
  category: { type: String, enum: categoryEnum, required: true },
  title: { type: String, required: true },
  description: { type: String },
  rule: { type: String },
  examples: { type: String },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

brandGuidelineSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BrandGuideline', brandGuidelineSchema);
