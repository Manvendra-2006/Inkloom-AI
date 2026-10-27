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
    console.log('AI Service response data ->', response.data);
    return response.data;
  } catch (err) {
    const serviceError = new Error(
      err.response
        ? `AI service returned HTTP ${err.response.status}`
        : 'AI service unavailable. Please start the FastAPI AI service and try again.'
    );
    serviceError.statusCode = 503;
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
    const status = err.response?.status;
    console.error('AI improvement service error:', {
      status,
      data: err.response?.data,
      code: err.code,
      error: err.message,
      payload,
    });

    let message = 'AI suggestions failed. Check the FastAPI and Ollama service logs.';
    let statusCode = 502;
    if (!err.response) {
      message = err.code === 'ECONNABORTED'
        ? 'AI suggestions timed out. Check the Ollama service and model response time.'
        : 'Could not reach the FastAPI AI service.';
      statusCode = 503;
    } else if (status === 503) {
      message = 'The suggestion model is unavailable. Verify OLLAMA_URL and that llama3:latest is running.';
      statusCode = 503;
    } else if (status === 409) {
      message = err.response.data?.detail
        || 'The audit findings no longer match this advertisement. Run AI Check again.';
      statusCode = 409;
    } else if (status === 422) {
      message = 'FastAPI rejected the suggestion request. Check the FastAPI validation error in the Render logs.';
    } else if (status === 502) {
      message = 'The suggestion model returned an invalid response. Check the FastAPI logs and try again.';
    }

    const serviceError = new Error(message);
    serviceError.statusCode = statusCode;
    throw serviceError;
  }
}

module.exports = { checkAd, suggestImprovements };
