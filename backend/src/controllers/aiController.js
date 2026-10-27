// backend/src/controllers/aiController.js
const Advertisement = require('../models/Advertisement');
const BrandGuideline = require('../models/BrandGuideline');
const ComplianceReport = require('../models/ComplianceReport');
const { checkAd, suggestImprovements } = require('../services/ai/aiService');

function normalizeTerms(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => typeof entry === 'string' ? entry.split(',') : [])
    .map((term) => term.trim())
    .filter(Boolean);
}

function buildGuidelineContext(brandGuideline) {
  return {
    id: brandGuideline._id.toString(),
    version: brandGuideline.version,
    isActive: brandGuideline.isActive,
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
}

function matchedTextExistsInAdvertisement(matchedText, adText) {
  const escapedText = matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w])${escapedText}(?=$|[^\\w])`, 'i').test(adText);
}

function normalizeFindings(findings, advertisement) {
  const adText = `${advertisement.title}\n${advertisement.caption || ''}`;

  return findings.flatMap((finding) => {
    const matchedText = String(finding.matched_text || finding.matchedText || '').trim();
    if (!matchedText || !matchedTextExistsInAdvertisement(matchedText, adText)) return [];

    const sources = Array.isArray(finding.sources)
      ? finding.sources
      : [finding.source || 'ai'];
    const includesAiSource = sources.includes('ai') || sources.includes('ai_review');
    const guidelineId = finding.guideline_id && finding.guideline_id !== 'BRAND-CUSTOM'
      ? String(finding.guideline_id)
      : null;

    return [{
      ...finding,
      guideline_id: guidelineId,
      source: includesAiSource
        ? 'ai'
        : sources[0] === 'rule_based' ? 'rule' : sources[0] || 'ai',
      mapping_status: guidelineId ? 'mapped' : 'unmapped',
      category: String(finding.category || 'other').toLowerCase(),
      severity: String(finding.severity || 'medium').toLowerCase(),
      matched_text: matchedText,
      reason: finding.reason || finding.explanation || finding.issue || '',
    }];
  });
}

async function getEmployeeAdvertisement(adId, userId) {
  const ad = await Advertisement.findById(adId);
  if (!ad) return { error: { status: 404, message: 'Advertisement not found' } };
  if (ad.createdBy.toString() !== userId) {
    return { error: { status: 403, message: "Cannot access others' ads" } };
  }
  if (!ad.brandGuideline) {
    return { error: { status: 400, message: 'Select a brand profile before running the AI check' } };
  }

  const brandGuideline = await BrandGuideline.findOne({
    _id: ad.brandGuideline,
    type: 'profile',
  });
  if (!brandGuideline) {
    return { error: { status: 400, message: 'The advertisement brand profile could not be found' } };
  }

  return { ad, brandGuideline, guidelineContext: buildGuidelineContext(brandGuideline) };
}

async function markAiUnavailable(ad) {
  ad.aiStatus = 'unavailable';
  ad.aiComplianceScore = undefined;
  ad.aiCheckedAt = undefined;
  ad.aiReport = undefined;
  await ad.save();
}

/**
 * POST /api/ai/check-ad/:adId
 * Requires employee role, JWT auth handled by middleware.
 */
async function checkAdvertisement(req, res, next) {
  let advertisement;
  try {
    const record = await getEmployeeAdvertisement(req.params.adId, req.user.id);
    if (record.error) return res.status(record.error.status).json({ message: record.error.message });
    const { ad, guidelineContext } = record;
    if (!['DRAFT', 'CHANGES_REQUIRED'].includes(ad.status)) {
      return res.status(400).json({ message: 'Only drafts or change-required advertisements can be checked' });
    }
    advertisement = ad;
    const adData = { title: ad.title, caption: ad.caption, imageUrl: ad.imageUrl };
    let aiResult;
    try {
      aiResult = await checkAd(adData, guidelineContext);
    } catch (error) {
      if (error.statusCode >= 502) await markAiUnavailable(ad);
      throw error;
    }

    if (
      !aiResult
      || !Array.isArray(aiResult.combined_findings)
      || aiResult.combined_findings.some(
        (finding) => !finding || typeof finding !== 'object' || Array.isArray(finding)
      )
      || !Number.isInteger(aiResult.finding_count)
      || aiResult.finding_count < 0
      || aiResult.combined_findings.length !== aiResult.finding_count
      || !['flagged', 'clean', 'no_flags'].includes(aiResult.status)
    ) {
      const error = new Error('AI service returned an invalid audit response');
      error.statusCode = 502;
      throw error;
    }

    const findings = normalizeFindings(aiResult.combined_findings, adData);
    const normalizedResult = {
      ...aiResult,
      status: findings.length ? 'flagged' : 'clean',
      finding_count: findings.length,
      findings,
      combined_findings: findings,
      human_review_required: aiResult.human_review_required !== false,
    };
    const normalizedAiStatus = findings.length ? 'flagged' : 'clean';
    const score = Math.max(0, 100 - findings.length * 10);
    const checkedAt = new Date();

    const report = ad.aiReport
      ? await ComplianceReport.findById(ad.aiReport) || new ComplianceReport()
      : new ComplianceReport();
    report.advertisementId = ad._id;
    report.score = score;
    report.status = normalizedAiStatus;
    report.finding_count = findings.length;
    report.issues = findings;
    report.rawResult = normalizedResult;
    report.brandGuidelineSnapshot = guidelineContext;
    report.advertisementSnapshot = {
      title: ad.title,
      caption: ad.caption || '',
      imageUrl: ad.imageUrl || '',
    };
    report.checkedAt = checkedAt;
    await report.save();

    ad.aiComplianceScore = score;
    ad.aiStatus = normalizedAiStatus;
    ad.aiCheckedAt = checkedAt;
    ad.aiReport = report._id;
    ad.status = normalizedAiStatus === 'flagged'
      ? 'CHANGES_REQUIRED'
      : ad.status === 'CHANGES_REQUIRED' ? 'DRAFT' : ad.status;
    await ad.save();

    res.json({
      ...normalizedResult,
      score,
      aiStatus: ad.aiStatus,
      aiCheckedAt: ad.aiCheckedAt,
      workflowStatus: ad.status,
      brandGuidelineSnapshot: guidelineContext,
      rawResult: normalizedResult,
    });
  } catch (err) {
    if (advertisement && err.statusCode >= 502 && advertisement.aiStatus !== 'unavailable') {
      await markAiUnavailable(advertisement);
    }
    console.error('AI check error:', err.message);
    next(err);
  }
}

async function getImprovementSuggestions(req, res, next) {
  try {
    const record = await getEmployeeAdvertisement(req.params.adId, req.user.id);
    if (record.error) return res.status(record.error.status).json({ message: record.error.message });
    const { ad, guidelineContext } = record;
    if (
      !['DRAFT', 'CHANGES_REQUIRED'].includes(ad.status)
      || ad.aiStatus !== 'flagged'
      || !ad.aiReport
    ) {
      return res.status(400).json({ message: 'Run an AI check and review its findings before requesting suggestions' });
    }

    const report = await ComplianceReport.findById(ad.aiReport);
    if (!report || !Array.isArray(report.issues) || report.issues.length === 0) {
      return res.status(400).json({ message: 'No current AI findings are available for suggestions' });
    }

    const adText = `${ad.title}\n${ad.caption || ''}`;
    const verifiedFindings = report.issues.filter((finding) => {
      const matchedText = String(finding.matched_text || finding.matchedText || '').trim();
      return matchedText && matchedTextExistsInAdvertisement(matchedText, adText);
    });
    if (verifiedFindings.length === 0) {
      return res.status(409).json({
        message: 'The saved audit findings do not match the current advertisement. Run AI Check again before requesting suggestions.',
      });
    }

    const result = await suggestImprovements(
      { title: ad.title, caption: ad.caption || '' },
      guidelineContext,
      verifiedFindings
    );
    if (
      !result
      || !Array.isArray(result.suggestions)
      || result.suggestions.length === 0
      || result.suggestions.some((suggestion) =>
        !suggestion
        || typeof suggestion.original_text !== 'string'
        || !suggestion.original_text.trim()
        || typeof suggestion.reason !== 'string'
        || !suggestion.reason.trim()
        || typeof suggestion.suggested_replacement !== 'string'
        || !suggestion.suggested_replacement.trim()
      )
      || !result.revised_draft
      || typeof result.revised_draft.title !== 'string'
      || !result.revised_draft.title.trim()
      || typeof result.revised_draft.caption !== 'string'
      || !result.revised_draft.caption.trim()
    ) {
      const error = new Error('AI service returned an invalid suggestion response');
      error.statusCode = 502;
      throw error;
    }

    res.json({
      suggestions: result.suggestions,
      revised_draft: result.revised_draft,
      human_review_required: result.human_review_required !== false,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { checkAdvertisement, getImprovementSuggestions };