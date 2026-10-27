// backend/src/services/ai/aiService.js
const axios = require('axios');
const config = require('../../config');

function getServiceUrl(path) {
  const serviceBaseUrl = config.AI_SERVICE_URL
    .replace(/\/+$/, '')
    .replace(/\/(?:api\/check|audit|improve)$/, '');
  return `${serviceBaseUrl}/${path}`;
}

async function checkAd(advertisement, brandGuideline) {
  const text = `${advertisement.title}\n${advertisement.caption || ''}`;
  const payload = {
    text,
    brand_guideline: {
      id: brandGuideline.id,
      version: brandGuideline.version,
      is_active: brandGuideline.isActive,
      name: brandGuideline.name,
      description: brandGuideline.description,
      tone_of_voice: brandGuideline.toneOfVoice,
      preferred_terminology: brandGuideline.preferredTerminology,
      terms_requiring_review: brandGuideline.termsRequiringReview,
      guidelines: brandGuideline.guidelines.map((guideline) => ({
        guideline_id: guideline.id,
        category: guideline.category,
        title: guideline.title,
        description: guideline.description,
        rule: guideline.rule,
        examples: guideline.examples,
        severity: guideline.severity,
        active: guideline.active,
      })),
    },
  };
  if (advertisement.imageUrl) payload.image_url = advertisement.imageUrl;
  const serviceUrl = getServiceUrl('audit');

  console.log('AI Service request ->', serviceUrl);

  try {
    const response = await axios.post(serviceUrl, payload);
    console.log('AI Service response status ->', response.status);
    return response.data;
  } catch (err) {
    const unavailable = !err.response || err.response.status === 503;
    const serviceError = new Error(
      unavailable
        ? 'AI service unavailable. Please start the FastAPI AI service and try again.'
        : `AI service returned HTTP ${err.response.status}`
    );
    serviceError.statusCode = unavailable ? 503 : 502;
    throw serviceError;
  }
}

async function suggestImprovements(advertisement, brandGuideline, findings) {
  const toStringArray = (value) => (
    Array.isArray(value) ? value.map((item) => String(item)) : []
  );
  const payload = {
    title: String(advertisement.title || ''),
    caption: String(advertisement.caption || ''),
    brand_guideline: {
      id: brandGuideline.id ? String(brandGuideline.id) : null,
      version: String(brandGuideline.version || '1.0'),
      is_active: brandGuideline.isActive !== false,
      name: String(brandGuideline.name || ''),
      description: String(brandGuideline.description || ''),
      tone_of_voice: String(brandGuideline.toneOfVoice || ''),
      preferred_terminology: toStringArray(brandGuideline.preferredTerminology),
      terms_requiring_review: toStringArray(brandGuideline.termsRequiringReview),
      guidelines: (Array.isArray(brandGuideline.guidelines) ? brandGuideline.guidelines : []).map((guideline) => ({
        guideline_id: guideline.id ? String(guideline.id) : null,
        category: String(guideline.category || ''),
        title: String(guideline.title || ''),
        description: String(guideline.description || ''),
        rule: String(guideline.rule || ''),
        examples: String(guideline.examples || ''),
        severity: String(guideline.severity || 'MEDIUM'),
        active: guideline.active !== false,
      })),
    },
    findings: findings.map((finding) => ({
      guideline_id: finding.guideline_id ? String(finding.guideline_id) : null,
      source: String(finding.source || 'ai'),
      mapping_status: String(finding.mapping_status || 'unmapped'),
      category: String(finding.category || ''),
      severity: String(finding.severity || 'medium'),
      matched_text: String(finding.matched_text || finding.matchedText || ''),
      reason: String(finding.reason || ''),
    })),
  };

  try {
    const response = await axios.post(getServiceUrl('improve'), payload, { timeout: 120000 });
    return response.data;
  } catch (err) {
    console.error('AI improvement service error:', {
      status: err.response?.status,
      data: err.response?.data,
      payload,
    });
    const serviceError = new Error('Unable to generate AI suggestions. Please try again.');
    serviceError.statusCode = err.response ? 502 : 503;
    throw serviceError;
  }
}

module.exports = { checkAd, suggestImprovements };
