// backend/src/routes/advertisements.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const Advertisement = require('../models/Advertisement');
const BrandGuideline = require('../models/BrandGuideline');
const mongoose = require('mongoose');

const router = express.Router();

// Return only the authenticated employee's advertisements.
router.get('/my-submissions', auth, role('EMPLOYEE'), async (req, res, next) => {
  try {
    const ads = await Advertisement.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('aiReport')
      .populate('brandGuideline', 'name version');
    res.json(ads);
  } catch (err) {
    next(err);
  }
});

// Create draft advertisement (EMPLOYEE)
router.post(
  '/',
  auth,
  role('EMPLOYEE'),
  [
    body('title').notEmpty(),
    body('brandGuideline').notEmpty().withMessage('A brand profile is required'),
    body('caption').optional(),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL'),
  ],
  async (req, res, next) => {
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
      if (!profile) return res.status(400).json({ message: 'Brand profile not found' });
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
);

// Get own advertisements (EMPLOYEE) or all (ADMIN)
router.get('/', auth, async (req, res, next) => {
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
});

// Update draft or change‑required ad (EMPLOYEE)
router.put(
  '/:id',
  auth,
  role('EMPLOYEE'),
  [
    body('title').optional().notEmpty(),
    body('caption').optional(),
    body('imageUrl').optional().isURL(),
    body('brandGuideline').optional().isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const ad = await Advertisement.findById(req.params.id);
      if (!ad) return res.status(404).json({ message: 'Not found' });
      if (ad.createdBy.toString() !== req.user.id)
        return res.status(403).json({ message: 'Forbidden' });
      if (!['DRAFT', 'CHANGES_REQUIRED'].includes(ad.status))
        return res.status(400).json({ message: 'Only drafts or change‑required ads can be edited' });
      const { title, caption, imageUrl, brandGuideline } = req.body;
      if (brandGuideline !== undefined) {
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
      if (caption !== undefined) ad.caption = caption;
      if (imageUrl) ad.imageUrl = imageUrl;
      await ad.save();
      res.json(ad);
    } catch (err) {
      next(err);
    }
  }
);

// Submit advertisement for review (EMPLOYEE) – must be AI‑checked first
router.post(
  '/:id/submit',
  auth,
  role('EMPLOYEE'),
  async (req, res, next) => {
    try {
      const ad = await Advertisement.findById(req.params.id);
      if (!ad) return res.status(404).json({ message: 'Not found' });
      if (ad.createdBy.toString() !== req.user.id)
        return res.status(403).json({ message: 'Forbidden' });
      if (ad.aiStatus !== 'clean')
        return res.status(400).json({ message: 'Advertisement must pass a clean AI check before submission' });
      if (ad.status !== 'PENDING_REVIEW') ad.status = 'PENDING_REVIEW';
      await ad.save();
      res.json({ message: 'Submitted for review', ad });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
