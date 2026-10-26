// backend/src/services/social/instagramService.js
const config = require('../../config');
const axios = require('axios');

async function publishPost({ accessToken, content, imageUrl }) {
  if (config.SOCIAL_MEDIA_MODE === 'mock') {
    await new Promise(r => setTimeout(r, 300));
    return {
      success: true,
      platform: 'instagram',
      postId: 'MOCK-INSTA-12345',
      status: 'PUBLISHED',
    };
  }
  // Real Instagram Graph API call (simplified, assumes Business Account)
  const url = `https://graph.facebook.com/v15.0/${content.instagramUserId}/media`;
  const payload = {
    caption: content.caption,
    image_url: imageUrl,
    access_token: accessToken,
  };
  const mediaRes = await axios.post(url, payload);
  const creationId = mediaRes.data.id;
  // Publish
  const publishUrl = `https://graph.facebook.com/v15.0/${content.instagramUserId}/media_publish`;
  const publishRes = await axios.post(publishUrl, {
    creation_id: creationId,
    access_token: accessToken,
  });
  return { success: true, platform: 'instagram', postId: publishRes.data.id, status: 'PUBLISHED' };
}

module.exports = { publishPost };
