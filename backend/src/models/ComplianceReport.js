// models/ComplianceReport.js
const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  category: { type: String, required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
  issue: { type: String, required: true },
  explanation: { type: String },
  violatedGuideline: { type: String },
  suggestion: { type: String },
});

const complianceReportSchema = new mongoose.Schema({
  advertisementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertisement', required: true },
  score: { type: Number, required: true },
  status: { type: String, enum: ['NEEDS_CHANGES', 'PASS'], default: 'PASS' },
  issues: [issueSchema],
  checkedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ComplianceReport', complianceReportSchema);
