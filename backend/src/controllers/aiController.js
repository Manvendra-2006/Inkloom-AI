// backend/src/controllers/aiController.js
const Advertisement = require('../models/Advertisement');
const BrandGuideline = require('../models/BrandGuideline');
const ComplianceReport = require('../models/ComplianceReport');
const { checkAd } = require('../services/ai/aiService');

/**
 * POST /api/ai/check-ad/:adId
 * Requires employee role, JWT auth handled by middleware.
 */
async function checkAdvertisement(req, res, next) {
  try {
    const { adId } = req.params;
    const ad = await Advertisement.findById(adId);
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });
    if (ad.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Cannot check others' ads" });
    }
    // fetch active guidelines (still stored in MongoDB for UI purposes)
    const guidelines = await BrandGuideline.find({ active: true });
    const adData = { title: ad.title, caption: ad.caption, imageUrl: ad.imageUrl };
    const aiResult = await checkAd(adData, guidelines);

    // Map FastAPI response to the shape expected by the frontend
    const issues = (aiResult.combined_findings || []).map((f) => ({
      category: f.category || 'GENERAL',
      severity: (f.severity || 'MEDIUM').toUpperCase(),
      issue: f.finding || f.issue || 'Potential issue',
      explanation: f.explanation || '',
      suggestion: f.suggestion || '',
      violatedGuideline: f.rule || f.violatedGuideline || '',
    }));

    const score = typeof aiResult.finding_count === 'number'
      ? Math.max(0, 100 - aiResult.finding_count * 10)
      : 0;

    // store compliance report, keep raw AI response for future debugging
    const report = new ComplianceReport({
      advertisementId: ad._id,
      score,
      status: aiResult.status || (issues.length ? 'NEEDS_CHANGES' : 'PASS'),
      issues,
      // rawResult: aiResult, // uncomment if schema adds rawResult field
    });
    await report.save();

    // link report to ad and update advertisement status
    ad.aiComplianceScore = score;
    ad.aiReport = report._id;
    ad.status = report.status === 'PASS' ? 'AI_CHECKED' : 'CHANGES_REQUIRED';
    await ad.save();

    res.json({
      score,
      status: ad.status,
      issues,
    });
  } catch (err) {
    // Enhanced error logging – include endpoint URL from config if available
    console.error('AI check error:', err.message);
    if (err.response) {
      console.error('Python service responded with', err.response.status, err.response.data);
    }
    next(err);
  }
}

module.exports = { checkAdvertisement };