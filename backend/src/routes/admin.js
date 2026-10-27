// backend/src/routes/admin.js
const express = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const Review = require('../models/Review');
const Advertisement = require('../models/Advertisement');
const PublishingRecord = require('../models/PublishingRecord');
const router = express.Router();

// All admin routes require ADMIN role
router.use(auth, role('ADMIN'));

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

router.get('/history', async (req, res, next) => {
  try {
    const ads = await Advertisement.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('brandGuideline', 'name version')
      .populate('aiReport');
    const advertisementIds = ads.map((ad) => ad._id);

    const [reviews, publishingRecords] = advertisementIds.length
      ? await Promise.all([
        Review.find({ advertisementId: { $in: advertisementIds } })
          .sort({ createdAt: -1 })
          .populate('adminId', 'name email'),
        PublishingRecord.find({ advertisementId: { $in: advertisementIds } })
          .sort({ publishedAt: -1, createdAt: -1 }),
      ])
      : [[], []];

    const reviewsByAdvertisement = new Map();
    for (const review of reviews) {
      const key = review.advertisementId.toString();
      const advertisementReviews = reviewsByAdvertisement.get(key) || [];
      advertisementReviews.push(review);
      reviewsByAdvertisement.set(key, advertisementReviews);
    }

    const latestPublications = new Map();
    for (const publication of publishingRecords) {
      const key = publication.advertisementId.toString();
      if (!latestPublications.has(key)) latestPublications.set(key, publication);
    }

    const history = ads.map((ad) => {
      const report = ad.aiReport;
      const reviewEvents = reviewsByAdvertisement.get(ad._id.toString()) || [];
      const review = reviewEvents[0];
      const publication = latestPublications.get(ad._id.toString());
      const findings = Array.isArray(report?.issues)
        ? report.issues
        : Array.isArray(report?.rawResult?.combined_findings)
          ? report.rawResult.combined_findings
          : [];
      const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const severities = findings
        .map((finding) => String(finding?.severity || '').toUpperCase())
        .filter((severity) => severityOrder.includes(severity));
      const highestSeverity = severityOrder.find((severity) => severities.includes(severity)) || null;
      const dates = [
        ad.createdAt,
        report?.checkedAt,
        review?.createdAt,
        publication?.publishedAt,
      ].filter(Boolean)
        .map((date) => new Date(date))
        .filter((date) => Number.isFinite(date.getTime()));
      const latestActivityAt = dates.length
        ? new Date(Math.max(...dates.map((date) => date.getTime())))
        : null;

      return {
        _id: ad._id,
        title: ad.title,
        caption: ad.caption || '',
        creator: ad.createdBy || null,
        brand: ad.brandGuideline || null,
        aiStatus: ad.aiStatus || (
          ['clean', 'no_flags'].includes(report?.status) ? 'clean'
            : report?.status === 'flagged' ? 'flagged' : null
        ),
        score: ad.aiComplianceScore ?? report?.score ?? null,
        findingCount: report?.finding_count ?? findings.length,
        severity: highestSeverity,
        adminAction: review?.action || null,
        reviewedBy: review?.adminId || null,
        reviewedAt: review?.createdAt || null,
        reviewEvents: reviewEvents.map((event) => ({
          action: event.action,
          comment: event.comment || '',
          reviewedBy: event.adminId,
          createdAt: event.createdAt,
        })),
        report: report || null,
        status: ad.status,
        createdAt: ad.createdAt,
        checkedAt: report?.checkedAt || ad.aiCheckedAt || null,
        publishedAt: publication?.publishedAt || null,
        publicationStatus: publication?.status || null,
        latestActivityAt,
      };
    });

    res.json(history);
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
