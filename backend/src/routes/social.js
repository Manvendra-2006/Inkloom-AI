// backend/src/routes/social.js
const express = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const SocialAccount = require('../models/SocialAccount');
const { encrypt, decrypt } = require('../services/social/tokenService');
const config = require('../config');
const { publishPost: publishLinkedIn } = require('../services/social/linkedinService');
const { publishPost: publishInstagram } = require('../services/social/instagramService');
// Placeholder services for Facebook and X (mock only for now)
const { publishPost: publishFacebook } = require('../services/social/facebookService');
const { publishPost: publishX } = require('../services/social/xService');

const router = express.Router();

// All routes require authentication. Connect/Publish actions require ADMIN role.
router.use(auth);
router.use(role('ADMIN'));

// Connect social account – initiate OAuth flow (mock returns success immediately in mock mode)
router.post('/connect', async (req, res, next) => {
  try {
    const { platform } = req.body; // linkedin, instagram, facebook, x
    if (!['linkedin', 'instagram', 'facebook', 'x'].includes(platform)) {
      return res.status(400).json({ message: 'Unsupported platform' });
    }
    if (config.SOCIAL_MEDIA_MODE === 'mock') {
      // create a fake account record
      const fakeAccount = new SocialAccount({
        userId: req.user.id,
        platform,
        platformUserId: 'mock-user-id',
        accountName: `${platform.toUpperCase()}_MOCK_ACCOUNT`,
        accessToken: encrypt('mock-access-token'),
        refreshToken: encrypt('mock-refresh-token'),
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      await fakeAccount.save();
      return res.json({ message: `${platform} account connected (mock)`, account: fakeAccount });
    }
    // TODO: real OAuth redirect URL generation per platform
    res.status(501).json({ message: 'OAuth flow not implemented in this scaffold' });
  } catch (err) {
    next(err);
  }
});

// List connected accounts for admin
router.get('/accounts', async (req, res, next) => {
  try {
    const accounts = await SocialAccount.find({ userId: req.user.id }).select('-accessToken -refreshToken');
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

// Delete a connected account
router.delete('/accounts/:id', async (req, res, next) => {
  try {
    const account = await SocialAccount.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// Publish advertisement to a platform
router.post('/publish', async (req, res, next) => {
  try {
    const { adId, platform, accountId } = req.body;
    if (!adId || !platform || !accountId) {
      return res.status(400).json({ message: 'adId, platform, and accountId required' });
    }
    const ad = await require('../models/Advertisement').findById(adId);
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });
    if (ad.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Only APPROVED ads can be published' });
    }
    const account = await SocialAccount.findOne({ _id: accountId, userId: req.user.id, platform });
    if (!account) return res.status(404).json({ message: 'Social account not found' });

    // Decrypt token for use
    const accessToken = decrypt(account.accessToken);
    const content = { caption: ad.caption, imageUrl: ad.imageUrl, platformUserId: account.platformUserId };

    let result;
    switch (platform) {
      case 'linkedin':
        result = await publishLinkedIn({ accessToken, content, imageUrl: ad.imageUrl });
        break;
      case 'instagram':
        result = await publishInstagram({ accessToken, content, imageUrl: ad.imageUrl });
        break;
      case 'facebook':
        result = await publishFacebook({ accessToken, content, imageUrl: ad.imageUrl });
        break;
      case 'x':
        result = await publishX({ accessToken, content, imageUrl: ad.imageUrl });
        break;
      default:
        return res.status(400).json({ message: 'Unsupported platform' });
    }

    // Record publishing result
    const PublishingRecord = require('../models/PublishingRecord');
    const record = new PublishingRecord({
      advertisementId: ad._id,
      platform,
      socialAccountId: account._id,
      platformPostId: result.postId,
      status: result.success ? 'PUBLISHED' : 'FAILED',
      publishedAt: result.success ? new Date() : undefined,
      errorMessage: result.success ? undefined : result.errorMessage,
    });
    await record.save();

    // Update ad status to PUBLISHED after successful publish
    if (result.success) {
      ad.status = 'PUBLISHED';
      await ad.save();
    }

    res.json({ message: 'Publish completed', result, record });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
