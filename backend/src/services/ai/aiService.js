// backend/src/services/ai/aiService.js
const axios = require('axios');
const config = require('../../config');

function getServiceUrl(path) {
  const serviceBaseUrl = (config.AI_SERVICE_URL || 'https://inkloom-ai-2.onrender.com')
    .replace(/\/+$/, '')
    .replace(/\/(?:api\/check|audit|improve|suggest-improvements)$/, '');
  return `${serviceBaseUrl}/${path}`;
}

async function checkAd(advertisement, brandGuideline) {
  const text = `${advertisement.title}\n${advertisement.caption || ''}`.trim() || advertisement.title;
  const payload = {
    text,
    brand_guideline: {
      id: brandGuideline.id ? String(brandGuideline.id) : undefined,
      version: brandGuideline.version ? String(brandGuideline.version) : '1.0',
      is_active: brandGuideline.isActive !== false,
      name: String(brandGuideline.name || 'Brand').trim() || 'Brand',
      description: String(brandGuideline.description || 'Brand description').trim() || 'Brand description',
      tone_of_voice: String(brandGuideline.toneOfVoice || 'Professional').trim() || 'Professional',
      preferred_terminology: Array.isArray(brandGuideline.preferredTerminology)
        ? brandGuideline.preferredTerminology.map(String).map((s) => s.trim()).filter(Boolean)
        : [],
      terms_requiring_review: Array.isArray(brandGuideline.termsRequiringReview)
        ? brandGuideline.termsRequiringReview.map(String).map((s) => s.trim()).filter(Boolean)
        : [],
      guidelines: (Array.isArray(brandGuideline.guidelines) ? brandGuideline.guidelines : [])
        .filter((g) => g && (g.title || g.rule))
        .map((guideline) => ({
          guideline_id: guideline.id ? String(guideline.id) : undefined,
          category: String(guideline.category || 'general').trim() || 'general',
          title: String(guideline.title || guideline.rule || 'Guideline').trim(),
          description: String(guideline.description || ''),
          rule: String(guideline.rule || ''),
          examples: String(guideline.examples || ''),
          severity: String(guideline.severity || 'medium').toLowerCase(),
          active: guideline.active !== false,
        })),
    },
  };
  if (advertisement.imageUrl) payload.image_url = advertisement.imageUrl;
  const serviceUrl = getServiceUrl('audit');

  console.log('AI Service request ->', serviceUrl);

  try {
    const response = await axios.post(serviceUrl, payload, { timeout: 30000 });
    console.log('AI Service response status ->', response.status);
    return response.data;
  } catch (err) {
    console.error('AI audit service error:', err.response?.data || err.message);
    const serviceError = new Error(
      err.response
        ? `AI service returned HTTP ${err.response.status}`
        : 'AI service unavailable. Please check the AI service status and try again.'
    );
    serviceError.statusCode = err.response ? 502 : 503;
    throw serviceError;
  }
}

async function suggestImprovements(advertisement, brandGuideline, findings) {
  const text = `${advertisement.title}\n${advertisement.caption || ''}`.trim() || advertisement.title;
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

  try {
    const response = await axios.post(serviceUrl, payload, { timeout: 30000 });
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
    const status = err.response?.status;
    console.error('AI improvement service error:', {
      status,
      data: err.response?.data,
      code: err.code,
      error: err.message,
    });

    let message = 'AI suggestions failed. Please check the FastAPI service logs.';
    let statusCode = 502;
    if (!err.response) {
      message = err.code === 'ECONNABORTED'
        ? 'AI suggestions timed out. Please check the AI service response time.'
        : 'Could not reach the FastAPI AI service.';
      statusCode = 503;
    } else if (status === 503) {
      message = 'The suggestion model is unavailable on the FastAPI service.';
      statusCode = 503;
    } else if (status === 409) {
      message = err.response.data?.detail
        || 'The audit findings no longer match this advertisement. Run AI Check again.';
      statusCode = 409;
    } else if (status === 422) {
      message = 'FastAPI rejected the suggestion request due to validation error.';
      statusCode = 422;
    } else if (status === 502) {
      message = 'The suggestion model returned an invalid response.';
      statusCode = 502;
    }

    const serviceError = new Error(message);
    serviceError.statusCode = statusCode;
    throw serviceError;
  }
}

module.exports = { checkAd, suggestImprovements };
