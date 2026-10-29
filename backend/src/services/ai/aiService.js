// backend/src/services/ai/aiService.js
const axios = require('axios');
const config = require('../../config');

function getServiceUrl(path) {
  const rawBase = (config.AI_SERVICE_URL || 'https://inkloom-ai-2.onrender.com').trim();
  const serviceBaseUrl = rawBase
    .replace(/\/+$/, '')
    .replace(/\/(?:api\/check|audit|improve|suggest-improvements)$/, '');
  return `${serviceBaseUrl}/${path}`;
}

async function checkAd(advertisement, brandGuideline) {
  const text = `${advertisement.title || ''}\n${advertisement.caption || ''}`.trim()
    || String(advertisement.title || 'Advertisement text');

  // Strictly conform to FastAPI BrandGuidelineRequest schema (no extra id/version/is_active)
  const payload = {
    text,
    brand_guideline: {
      name: String(brandGuideline?.name || 'Brand').trim() || 'Brand',
      description: String(brandGuideline?.description || 'Brand description').trim() || 'Brand description',
      tone_of_voice: String(brandGuideline?.toneOfVoice || brandGuideline?.tone_of_voice || 'Professional').trim() || 'Professional',
      preferred_terminology: Array.isArray(brandGuideline?.preferredTerminology || brandGuideline?.preferred_terminology)
        ? (brandGuideline.preferredTerminology || brandGuideline.preferred_terminology).map(String).map((s) => s.trim()).filter(Boolean)
        : [],
      terms_requiring_review: Array.isArray(brandGuideline?.termsRequiringReview || brandGuideline?.terms_requiring_review)
        ? (brandGuideline.termsRequiringReview || brandGuideline.terms_requiring_review).map(String).map((s) => s.trim()).filter(Boolean)
        : [],
      guidelines: (Array.isArray(brandGuideline?.guidelines) ? brandGuideline.guidelines : [])
        .filter((g) => g && (g.title || g.rule))
        .map((guideline) => ({
          guideline_id: guideline.guideline_id || guideline.id ? String(guideline.guideline_id || guideline.id) : undefined,
          category: String(guideline.category || 'general').trim().toLowerCase(),
          title: String(guideline.title || guideline.rule || 'Guideline').trim(),
          description: String(guideline.description || ''),
          rule: String(guideline.rule || ''),
          examples: String(guideline.examples || ''),
          severity: String(guideline.severity || 'medium').trim().toLowerCase(),
          active: guideline.active !== false,
        })),
    },
  };
  if (advertisement?.imageUrl) {
    payload.image_url = String(advertisement.imageUrl);
  }

  const serviceUrl = getServiceUrl('audit');

  // Diagnostic logging - safe, keys and metadata only (no secrets)
  const payloadKeys = {
    topLevelKeys: Object.keys(payload),
    brandGuidelineKeys: payload.brand_guideline ? Object.keys(payload.brand_guideline) : null,
    guidelinesCount: Array.isArray(payload.brand_guideline?.guidelines) ? payload.brand_guideline.guidelines.length : 0,
    preferredTermsCount: Array.isArray(payload.brand_guideline?.preferred_terminology) ? payload.brand_guideline.preferred_terminology.length : 0,
    reviewTermsCount: Array.isArray(payload.brand_guideline?.terms_requiring_review) ? payload.brand_guideline.terms_requiring_review.length : 0,
    hasImageUrl: Boolean(payload.image_url),
    textLength: payload.text.length,
  };

  console.log('[AI Check] Method: POST');
  console.log(`[AI Check] URL: ${serviceUrl}`);
  console.log(`[AI Check] Payload keys: ${JSON.stringify(payloadKeys)}`);

  const requestConfig = {
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Inkloom-Node-Backend/1.0',
    },
  };

  let response;
  try {
    try {
      response = await axios.post(serviceUrl, payload, requestConfig);
    } catch (initialErr) {
      const isRetryable = initialErr.response?.status === 502
        || initialErr.response?.status === 503
        || initialErr.code === 'ECONNABORTED'
        || initialErr.code === 'ETIMEDOUT';

      if (isRetryable) {
        console.warn(`[AI Check] Initial request returned ${initialErr.response?.status || initialErr.code}. Retrying in 2 seconds (FastAPI may be waking up)...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        response = await axios.post(serviceUrl, payload, requestConfig);
      } else {
        throw initialErr;
      }
    }

    const bodyPreview = typeof response.data === 'string'
      ? response.data.slice(0, 500)
      : JSON.stringify(response.data).slice(0, 500);

    console.log(`[AI Check] FastAPI response status: ${response.status}`);
    console.log(`[AI Check] FastAPI response body (first 500 chars): ${bodyPreview}`);
    return response.data;
  } catch (err) {
    const errorStatus = err.response ? err.response.status : null;
    const errorBody = err.response?.data
      ? (typeof err.response.data === 'string' ? err.response.data.slice(0, 500) : JSON.stringify(err.response.data).slice(0, 500))
      : null;

    console.error(`[AI Check Error] URL called: ${serviceUrl}`);
    console.error('[AI Check Error] HTTP method: POST');
    console.error(`[AI Check Error] Status: ${errorStatus || 'No response / Network error'}`);
    console.error(`[AI Check Error] Error code: ${err.code || 'None'}`);
    console.error(`[AI Check Error] Message: ${err.message}`);
    if (errorBody) {
      console.error(`[AI Check Error] Response body (first 500 chars): ${errorBody}`);
    }

    const message = errorStatus === 502
      ? 'The AI service returned HTTP 502 (Bad Gateway). The model instance may be waking up or restarting on Render. Please retry in a few seconds.'
      : err.response
        ? `AI service returned HTTP ${err.response.status}`
        : 'AI service unavailable. Please check the AI service status and try again.';

    const serviceError = new Error(message);
    serviceError.statusCode = err.response ? err.response.status : 503;
    throw serviceError;
  }
}

async function suggestImprovements(advertisement, brandGuideline, findings) {
  const text = `${advertisement.title || ''}\n${advertisement.caption || ''}`.trim()
    || String(advertisement.title || 'Advertisement');

  const payload = {
    text,
    brand_id: null,
    audit_findings: (findings || []).map((finding) => ({
      guideline_id: finding.guideline_id ? String(finding.guideline_id) : null,
      source: String(finding.source || 'ai'),
      mapping_status: String(finding.mapping_status || 'unmapped'),
      category: String(finding.category || ''),
      severity: String(finding.severity || 'medium'),
      matched_text: String(finding.matched_text || finding.matchedText || ''),
      reason: String(finding.reason || ''),
    })),
  };

  const serviceUrl = getServiceUrl('suggest-improvements');

  const payloadKeys = {
    topLevelKeys: Object.keys(payload),
    findingsCount: payload.audit_findings.length,
    textLength: payload.text.length,
  };

  console.log('[AI Suggestions] Method: POST');
  console.log(`[AI Suggestions] URL: ${serviceUrl}`);
  console.log(`[AI Suggestions] Payload keys: ${JSON.stringify(payloadKeys)}`);

  const requestConfig = {
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Inkloom-Node-Backend/1.0',
    },
  };

  let response;
  try {
    try {
      response = await axios.post(serviceUrl, payload, requestConfig);
    } catch (initialErr) {
      const isRetryable = initialErr.response?.status === 502
        || initialErr.response?.status === 503
        || initialErr.code === 'ECONNABORTED'
        || initialErr.code === 'ETIMEDOUT';

      if (isRetryable) {
        console.warn(`[AI Suggestions] Initial request returned ${initialErr.response?.status || initialErr.code}. Retrying in 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        response = await axios.post(serviceUrl, payload, requestConfig);
      } else {
        throw initialErr;
      }
    }

    const data = response.data || {};
    const rawSuggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    const normalizedSuggestions = [];

    // Helper to find finding matching original text or clean regex boundaries
    const findMatchedText = (pattern) => {
      const cleanPattern = pattern
        .replace(/^\\b|\\b\??$/g, '')
        .replace(/[\\^$*+?.()|[\]{}]/g, '')
        .trim()
        .toLowerCase();
      const match = (findings || []).find((f) => {
        const fText = String(f.matched_text || f.matchedText || '').trim().toLowerCase();
        return fText === cleanPattern || cleanPattern.includes(fText) || fText.includes(cleanPattern);
      });
      return match ? String(match.matched_text || match.matchedText) : cleanPattern;
    };

    for (const item of rawSuggestions) {
      if (!item || typeof item !== 'object') continue;
      const cleanOriginal = findMatchedText(String(item.original_text || ''));
      const replacement = String(item.suggested_replacement || '').trim();
      const reason = String(item.reason || 'This wording may need substantiation or a more precise claim.').trim();

      if (cleanOriginal && replacement) {
        normalizedSuggestions.push({
          original_text: cleanOriginal,
          suggested_replacement: replacement,
          reason,
          priority: item.priority || 'high',
        });
      }
    }

    // Ensure all findings have a suggestion if not already covered
    for (const finding of (findings || [])) {
      const matched = String(finding.matched_text || finding.matchedText || '').trim();
      if (!matched) continue;
      const alreadySuggested = normalizedSuggestions.some(
        (s) => s.original_text.toLowerCase() === matched.toLowerCase()
      );
      if (!alreadySuggested) {
        normalizedSuggestions.push({
          original_text: matched,
          suggested_replacement: 'a verified and approved statement',
          reason: finding.reason || finding.explanation || 'Ensure this claim is substantiated with approved documentation.',
          priority: finding.severity === 'high' ? 'high' : 'medium',
        });
      }
    }

    // Build revised draft
    let revisedTitle = String(advertisement.title || '');
    let revisedCaption = String(advertisement.caption || '');

    for (const s of normalizedSuggestions) {
      const orig = s.original_text;
      const repl = s.suggested_replacement;
      if (orig && repl) {
        const regex = new RegExp(`(^|[^\\w])${orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\w])`, 'i');
        if (regex.test(revisedTitle)) {
          revisedTitle = revisedTitle.replace(regex, `$1${repl}`);
        } else if (regex.test(revisedCaption)) {
          revisedCaption = revisedCaption.replace(regex, `$1${repl}`);
        }
      }
    }

    if (!revisedTitle.trim()) {
      revisedTitle = advertisement.title || 'Advertisement Title';
    }
    if (!revisedCaption.trim()) {
      revisedCaption = advertisement.caption || 'Approved marketing copy.';
    }

    return {
      message: data.message || 'Suggestions generated',
      brand_name: data.brand_name || 'Inkloom Demo Brand',
      suggestions: normalizedSuggestions,
      revised_draft: {
        title: revisedTitle,
        caption: revisedCaption,
      },
      human_review_required: true,
      original_text_unchanged: true,
      source: data.source || 'local_rules',
    };
  } catch (err) {
    const errorStatus = err.response ? err.response.status : null;
    const errorBody = err.response?.data
      ? (typeof err.response.data === 'string' ? err.response.data.slice(0, 500) : JSON.stringify(err.response.data).slice(0, 500))
      : null;

    console.error(`[AI Suggestions Error] URL called: ${serviceUrl}`);
    console.error('[AI Suggestions Error] HTTP method: POST');
    console.error(`[AI Suggestions Error] Status: ${errorStatus || 'No response / Network error'}`);
    console.error(`[AI Suggestions Error] Error code: ${err.code || 'None'}`);
    console.error(`[AI Suggestions Error] Message: ${err.message}`);
    if (errorBody) {
      console.error(`[AI Suggestions Error] Response body (first 500 chars): ${errorBody}`);
    }

    let message = 'AI suggestions failed. Please check the FastAPI service logs.';
    let statusCode = 502;
    if (!err.response) {
      message = err.code === 'ECONNABORTED'
        ? 'AI suggestions timed out. Please check the AI service response time.'
        : 'Could not reach the FastAPI AI service.';
      statusCode = 503;
    } else if (errorStatus === 502) {
      message = 'The AI service returned HTTP 502 (Bad Gateway). The model instance may be waking up or restarting on Render.';
      statusCode = 502;
    } else if (errorStatus === 503) {
      message = 'The suggestion model is unavailable on the FastAPI service.';
      statusCode = 503;
    } else if (errorStatus === 409) {
      message = err.response.data?.detail
        || 'The audit findings no longer match this advertisement. Run AI Check again.';
      statusCode = 409;
    } else if (errorStatus === 422) {
      message = 'FastAPI rejected the suggestion request due to validation error.';
      statusCode = 422;
    }

    const serviceError = new Error(message);
    serviceError.statusCode = statusCode;
    throw serviceError;
  }
}

module.exports = { checkAd, suggestImprovements };
