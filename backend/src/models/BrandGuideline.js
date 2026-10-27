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

const guidelineRuleSchema = new mongoose.Schema({
  category: { type: String, enum: categoryEnum, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  rule: { type: String, default: '' },
  examples: { type: String, default: '' },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  active: { type: Boolean, default: true },
});

const brandGuidelineSchema = new mongoose.Schema({
  type: { type: String, enum: ['profile'], default: 'profile', required: true },
  name: { type: String, trim: true, required: true },
  description: { type: String, required: true, trim: true },
  toneOfVoice: { type: String, trim: true, required: true },
  preferredTerminology: {
    type: [String],
    default: [],
  },
  termsRequiringReview: {
    type: [String],
    default: [],
  },
  guidelines: { type: [guidelineRuleSchema], default: [] },
  version: { type: String, default: '1.0' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('BrandGuideline', brandGuidelineSchema);
