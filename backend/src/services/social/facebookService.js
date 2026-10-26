// backend/src/services/social/facebookService.js
const config = require('../../config');
const axios = require('axios');

/**
 * Mock or real publishing to Facebook.
 * Real implementation would use the Facebook Graph API.
 */
async function publishPost({ accessToken, content, imageUrl }) {
  if (config.SOCIAL_MEDIA_MODE === 'mock') {
    await new Promise(r => setTimeout(r, 300));
    return {
      success: true,
      platform: 'facebook',
      postId: 'MOCK-FB-12345',
      status: 'PUBLISHED',
    };
  }
  // Placeholder for real call – not implemented in this scaffold
  throw new Error('Facebook publishing not implemented');
}

module.exports = { publishPost };
