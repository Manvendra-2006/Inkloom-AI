// backend/src/services/social/linkedinService.js
const config = require('../../config');
const axios = require('axios');

/**
 * Publish a post to LinkedIn.
 * In mock mode returns a deterministic response.
 * In production mode expects a valid access token.
 */
async function publishPost({ accessToken, content, imageUrl }) {
  if (config.SOCIAL_MEDIA_MODE === 'mock') {
    // simulate latency
    await new Promise(r => setTimeout(r, 300));
    return {
      success: true,
      platform: 'linkedin',
      postId: 'MOCK-LINKEDIN-12345',
      status: 'PUBLISHED',
    };
  }
  // Real LinkedIn API call (simplified)
  const url = 'https://api.linkedin.com/v2/ugcPosts';
  const payload = {
    author: `urn:li:person:${content.platformUserId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content.caption },
        shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
        media: imageUrl ? [{ status: 'READY', originalUrl: imageUrl }] : [],
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": 'PUBLIC' },
  };
  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
  });
  return { success: true, platform: 'linkedin', postId: response.data.id, status: 'PUBLISHED' };
}

module.exports = { publishPost };
