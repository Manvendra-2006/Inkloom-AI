// backend/src/controllers/advertisementController.js
const Advertisement = require('../models/Advertisement');
const { validationResult } = require('express-validator');

/**
 * Create a new draft advertisement (EMPLOYEE)
 */
async function createAd(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { title, caption, imageUrl } = req.body;
    const ad = new Advertisement({
      createdBy: req.user.id,
      title,
      caption,
      imageUrl,
      status: 'DRAFT',
    });
    await ad.save();
    res.status(201).json(ad);
  } catch (err) {
    next(err);
  }
}

/** Get advertisements – EMPLOYEE gets own, ADMIN gets all */
async function getAds(req, res, next) {
  try {
    let ads;
    if (req.user.role === 'ADMIN') {
      ads = await Advertisement.find().populate('createdBy', 'name email role');
    } else {
      ads = await Advertisement.find({ createdBy: req.user.id }).populate('createdBy', 'name email');
    }
    res.json(ads);
  } catch (err) {
    next(err);
  }
}

/** Update a draft or change‑required advertisement */
async function updateAd(req, res, next) {
  try {
    const ad = await Advertisement.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: 'Not found' });
    if (ad.createdBy.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    if (!['DRAFT', 'CHANGES_REQUIRED'].includes(ad.status)) {
      return res.status(400).json({ message: 'Only drafts or change‑required ads can be edited' });
    }
    const { title, caption, imageUrl } = req.body;
    if (title) ad.title = title;
    if (caption) ad.caption = caption;
    if (imageUrl) ad.imageUrl = imageUrl;
    await ad.save();
    res.json(ad);
  } catch (err) {
    next(err);
  }
}

/** Submit advertisement for review (must be AI_CHECKED) */
async function submitAd(req, res, next) {
  try {
    const ad = await Advertisement.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: 'Not found' });
    if (ad.createdBy.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    if (ad.status !== 'AI_CHECKED') {
      return res.status(400).json({ message: 'Advertisement must pass AI check before submission' });
    }
    ad.status = 'PENDING_REVIEW';
    await ad.save();
    res.json({ message: 'Submitted for review', ad });
  } catch (err) {
    next(err);
  }
}

module.exports = { createAd, getAds, updateAd, submitAd };
