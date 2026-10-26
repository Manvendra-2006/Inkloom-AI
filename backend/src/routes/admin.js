// backend/src/routes/admin.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const BrandGuideline = require('../models/BrandGuideline');
const Review = require('../models/Review');
const Advertisement = require('../models/Advertisement');
const PublishingRecord = require('../models/PublishingRecord'); // added import
const router = express.Router();

// All admin routes require ADMIN role
router.use(auth, role('ADMIN'));

// ==== Brand Guidelines CRUD ====
router.get('/guidelines', async (req, res, next) => {
  try {
    const guidelines = await BrandGuideline.find();
    res.json(guidelines);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/guidelines',
  [
    body('category').isIn([
      'TONE','TERMINOLOGY','FACTS','CLAIMS','MESSAGING','RESTRICTED_WORDS','BRANDING','ACCESSIBILITY'
    ]),
    body('title').notEmpty(),
    body('description').optional(),
    body('rule').optional(),
    body('examples').optional(),
    body('severity').optional().isIn(['LOW','MEDIUM','HIGH']),
    body('active').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const guideline = new BrandGuideline(req.body);
      await guideline.save();
      res.status(201).json(guideline);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/guidelines/:id',
  [
    body('category').optional().isIn([
      'TONE','TERMINOLOGY','FACTS','CLAIMS','MESSAGING','RESTRICTED_WORDS','BRANDING','ACCESSIBILITY'
    ]),
    body('title').optional().notEmpty(),
    body('severity').optional().isIn(['LOW','MEDIUM','HIGH']),
    body('active').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const guideline = await BrandGuideline.findById(req.params.id);
      if (!guideline) return res.status(404).json({ message: 'Guideline not found' });
      Object.assign(guideline, req.body);
      await guideline.save();
      res.json(guideline);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/guidelines/:id', async (req, res, next) => {
  try {
    const result = await BrandGuideline.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Guideline not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// ==== Review Actions ==== (approve, reject, request changes)
router.post('/reviews/:adId', async (req, res, next) => {
  try {
    const { adId } = req.params;
    const { action, comment } = req.body; // action: APPROVED | REJECTED | CHANGES_REQUESTED
    if (!['APPROVED','REJECTED','CHANGES_REQUESTED'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }
    const ad = await Advertisement.findById(adId);
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });
    if (ad.status !== 'PENDING_REVIEW' && ad.status !== 'CHANGES_REQUIRED') {
      return res.status(400).json({ message: 'Ad not in reviewable state' });
    }
    // create review record
    const review = new Review({
      advertisementId: ad._id,
      adminId: req.user.id,
      action,
      comment,
    });
    await review.save();
    // update ad status
    if (action === 'APPROVED') ad.status = 'APPROVED';
    else if (action === 'REJECTED') ad.status = 'REJECTED';
    else if (action === 'CHANGES_REQUESTED') ad.status = 'CHANGES_REQUIRED';
    await ad.save();
    res.json({ message: 'Review saved', ad });
  } catch (err) {
    next(err);
  }
});

// ==== Publishing History ==== (admin view only)
router.get('/publishing', async (req, res, next) => {
  try {
    const records = await PublishingRecord.find()
      .populate('advertisementId', 'title')
      .populate('socialAccountId', 'accountName platform');
    res.json(records);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
