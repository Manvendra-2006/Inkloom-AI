// backend/src/controllers/reviewController.js
const Advertisement = require('../models/Advertisement');
const Review = require('../models/Review');

/**
 * Admin review action: APPROVED, REJECTED, CHANGES_REQUESTED
 */
async function reviewAd(req, res, next) {
  try {
    const { adId } = req.params;
    const { action, comment } = req.body; // action validation done in route
    const ad = await Advertisement.findById(adId);
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });

    // create review record
    const review = new Review({
      advertisementId: ad._id,
      adminId: req.user.id,
      action,
      comment,
    });
    await review.save();

    // update ad status based on action
    if (action === 'APPROVED') ad.status = 'APPROVED';
    else if (action === 'REJECTED') ad.status = 'REJECTED';
    else if (action === 'CHANGES_REQUESTED') ad.status = 'CHANGES_REQUIRED';
    await ad.save();

    res.json({ message: 'Review saved', ad });
  } catch (err) {
    next(err);
  }
}

module.exports = { reviewAd };
