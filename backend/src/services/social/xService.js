// backend/src/services/social/xService.js
const config = require('../../config');
const axios = require('axios');

/**
 * Mock or real publishing to X (formerly Twitter).
 * Real implementation would use the X API with OAuth 2.0.
 */
async function publishPost({ accessToken, content, imageUrl }) {
  if (config.SOCIAL_MEDIA_MODE === 'mock') {
    await new Promise(r => setTimeout(r, 300));
    return {
      success: true,
      platform: 'x',
      postId: 'MOCK-X-12345',
      status: 'PUBLISHED',
    };
  }
  // Placeholder for real X API call – not implemented in this scaffold
  throw new Error('X publishing not implemented');
}

module.exports = { publishPost };
