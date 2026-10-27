// backend/src/controllers/aiController.js
const Advertisement = require('../models/Advertisement');
const BrandGuideline = require('../models/BrandGuideline');
const ComplianceReport = require('../models/ComplianceReport');
const { checkAd } = require('../services/ai/aiService');

function normalizeTerms(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => typeof entry === 'string' ? entry.split(',') : [])
    .map((term) => term.trim())
    .filter(Boolean);
}

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
    if (!ad.brandGuideline) {
      return res.status(400).json({ message: 'Select a brand profile before running the AI check' });
    }
    const brandGuideline = await BrandGuideline.findOne({
      _id: ad.brandGuideline,
      type: 'profile',
    });
    if (!brandGuideline) {
      return res.status(400).json({ message: 'The advertisement brand profile could not be found' });
    }

    const guidelineContext = {
      id: brandGuideline._id.toString(),
      version: brandGuideline.version,
      name: brandGuideline.name,
      description: brandGuideline.description,
      toneOfVoice: brandGuideline.toneOfVoice,
      preferredTerminology: normalizeTerms(brandGuideline.preferredTerminology),
      termsRequiringReview: normalizeTerms(brandGuideline.termsRequiringReview),
      guidelines: brandGuideline.guidelines.map((guideline) => ({
        id: guideline._id.toString(),
        category: guideline.category,
        title: guideline.title,
        description: guideline.description,
        rule: guideline.rule,
        examples: guideline.examples,
        severity: guideline.severity,
        active: guideline.active,
      })),
    };
    const adData = { title: ad.title, caption: ad.caption, imageUrl: ad.imageUrl };
    const aiResult = await checkAd(adData, guidelineContext);

    if (
      !aiResult
      || !Array.isArray(aiResult.combined_findings)
      || !Number.isInteger(aiResult.finding_count)
      || aiResult.finding_count < 0
      || aiResult.combined_findings.length !== aiResult.finding_count
      || !['flagged', 'clean', 'no_flags'].includes(aiResult.status)
    ) {
      const error = new Error('AI service returned an invalid audit response');
      error.statusCode = 502;
      throw error;
    }

    if (
      aiResult.ai_review?.ai_status === 'unavailable'
      && aiResult.combined_findings.length === 0
    ) {
      const error = new Error(
        'AI review is unavailable and no rule-based findings were found; the advertisement was not marked clean'
      );
      error.statusCode = 503;
      throw error;
    }

    const aiStatus = aiResult.status === 'flagged' ? 'flagged' : 'clean';
    const workflowStatus = aiStatus === 'flagged' ? 'CHANGES_REQUIRED' : 'PENDING_REVIEW';
    const score = Math.max(0, 100 - aiResult.finding_count * 10);
    const checkedAt = new Date();

    console.log('AI status ->', aiStatus);
    console.log('Finding count ->', aiResult.finding_count);
    console.log('Combined findings count ->', aiResult.combined_findings.length);

    const report = ad.aiReport
      ? await ComplianceReport.findById(ad.aiReport) || new ComplianceReport()
      : new ComplianceReport();
    report.advertisementId = ad._id;
    report.score = score;
    report.status = aiResult.status;
    report.finding_count = aiResult.finding_count;
    report.issues = aiResult.combined_findings;
    report.rawResult = aiResult;
    report.brandGuidelineSnapshot = guidelineContext;
    report.checkedAt = checkedAt;
    await report.save();

    ad.aiComplianceScore = score;
    ad.aiStatus = aiStatus;
    ad.aiCheckedAt = checkedAt;
    ad.aiReport = report._id;
    ad.status = workflowStatus;
    await ad.save();

    console.log('Advertisement workflow status ->', ad.status);
    console.log('Advertisement AI status ->', ad.aiStatus);

    res.json({
      ...aiResult,
      score,
      aiStatus: ad.aiStatus,
      aiCheckedAt: ad.aiCheckedAt,
      workflowStatus: ad.status,
      brandGuidelineSnapshot: guidelineContext,
      rawResult: aiResult,
    });
  } catch (err) {
    console.error('AI check error:', err.message);
    next(err);
  }
}

module.exports = { checkAdvertisement };