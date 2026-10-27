// backend/src/services/ai/aiService.js
const axios = require('axios');
const config = require('../../config');

async function checkAd(advertisement, brandGuideline) {
  const text = `${advertisement.title}\n${advertisement.caption || ''}`;
  const payload = {
    text,
    brand_guideline: {
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
  const serviceBaseUrl = config.AI_SERVICE_URL
    .replace(/\/+$/, '')
    .replace(/\/(?:api\/check|audit)$/, '');
  const serviceUrl = `${serviceBaseUrl}/audit`;

  console.log('AI Service request ->', serviceUrl);
  console.log('AI brand guideline context ->', JSON.stringify(payload.brand_guideline));

  try {
    const response = await axios.post(serviceUrl, payload);
    console.log('AI Service response status ->', response.status);
    return response.data;
  } catch (err) {
    const serviceError = new Error(
      err.response
        ? `AI service returned HTTP ${err.response.status}`
        : 'Could not reach the AI service'
    );
    serviceError.statusCode = 502;
    throw serviceError;
  }
}

module.exports = { checkAd };
