// backend/src/controllers/advertisementController.js
const Advertisement = require('../models/Advertisement');
const BrandGuideline = require('../models/BrandGuideline');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');

/**
 * Create a new draft advertisement (EMPLOYEE)
 */
async function createAd(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { title, caption, imageUrl, brandGuideline } = req.body;
    if (!mongoose.isValidObjectId(brandGuideline)) {
      return res.status(400).json({ message: 'A valid brand profile is required' });
    }
    const profile = await BrandGuideline.findOne({
      _id: brandGuideline,
      type: 'profile',
      isActive: { $ne: false },
    });
    if (!profile) return res.status(400).json({ message: 'A valid brand profile is required' });
    const ad = new Advertisement({
      createdBy: req.user.id,
      title,
      caption,
      imageUrl,
      brandGuideline: profile._id,
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
      ads = await Advertisement.find()
        .populate('createdBy', 'name email role')
        .populate('aiReport')
        .populate('brandGuideline');
    } else {
      ads = await Advertisement.find({ createdBy: req.user.id })
        .populate('createdBy', 'name email')
        .populate('aiReport')
        .populate('brandGuideline');
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
    const { title, caption, imageUrl, brandGuideline } = req.body;
    if (brandGuideline) {
      if (!mongoose.isValidObjectId(brandGuideline)) {
        return res.status(400).json({ message: 'A valid brand profile is required' });
      }
      const profile = await BrandGuideline.findOne({
        _id: brandGuideline,
        type: 'profile',
        isActive: { $ne: false },
      });
      if (!profile) return res.status(400).json({ message: 'Brand profile not found' });
      ad.brandGuideline = profile._id;
    }
    if (title) ad.title = title;
    if (caption) ad.caption = caption;
    if (imageUrl) ad.imageUrl = imageUrl;
    await ad.save();
    res.json(ad);
  } catch (err) {
    next(err);
  }
}

/** Submit an advertisement with a clean AI result for review */
async function submitAd(req, res, next) {
  try {
    const ad = await Advertisement.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: 'Not found' });
    if (ad.createdBy.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    if (ad.aiStatus !== 'clean') {
      return res.status(400).json({ message: 'Advertisement must pass a clean AI check before submission' });
    }
    if (ad.status !== 'PENDING_REVIEW') ad.status = 'PENDING_REVIEW';
    await ad.save();
    res.json({ message: 'Submitted for review', ad });
  } catch (err) {
    next(err);
  }
}

module.exports = { createAd, getAds, updateAd, submitAd };
