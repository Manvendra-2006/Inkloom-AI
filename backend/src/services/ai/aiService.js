// backend/src/services/ai/aiService.js
const axios = require('axios');
const config = require('../../config');

// Mock response generator
function mockResponse(ad) {
  return {
    score: 85,
    status: 'NEEDS_CHANGES',
    issues: [
      {
        category: 'TONE',
        severity: 'MEDIUM',
        issue: 'Tone is too casual',
        explanation: 'Brand tone should be professional and trustworthy.',
        violatedGuideline: 'Professional, friendly and trustworthy.',
        suggestion: 'Rewrite caption to use formal language.',
      },
    ],
  };
}

async function checkAd(advertisement, guidelines) {
  if (config.AI_MODE === 'mock') {
    // simulate async latency
    await new Promise((r) => setTimeout(r, 500));
    return mockResponse(advertisement);
  }
  // production mode – call external Python service
  // Build payload expected by FastAPI /audit endpoint
  const text = `${advertisement.title}\n${advertisement.caption}`;
  const payload = { text };
  // Brand guidelines are kept for possible future use but not sent to FastAPI
  const response = await axios.post(`${config.AI_SERVICE_URL}/audit`, payload);
    // Log request details for debugging
    console.log('AI Service request ->', `${config.AI_SERVICE_URL}/audit`);
    console.log('Payload sent:', payload);
  return response.data;
}

module.exports = { checkAd };
