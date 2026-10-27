// models/ComplianceReport.js
const mongoose = require('mongoose');

const complianceReportSchema = new mongoose.Schema({
  advertisementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertisement', required: true },
  score: { type: Number, required: true },
  status: { type: String, required: true },
  finding_count: { type: Number, required: true },
  issues: { type: [mongoose.Schema.Types.Mixed], default: [] },
  rawResult: { type: mongoose.Schema.Types.Mixed, required: true },
  brandGuidelineSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  advertisementSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  checkedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ComplianceReport', complianceReportSchema);
