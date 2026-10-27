// backend/src/routes/ai.js
const express = require('express');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const {
  checkAdvertisement,
  getImprovementSuggestions,
} = require('../controllers/aiController');

const router = express.Router();

// POST /api/ai/check-ad/:adId  (EMPLOYEE only)
router.post('/check-ad/:adId', auth, role('EMPLOYEE'), checkAdvertisement);
router.post('/suggest-improvements/:adId', auth, role('EMPLOYEE'), getImprovementSuggestions);

module.exports = router;
