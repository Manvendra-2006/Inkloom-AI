const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const BrandGuideline = require('../models/BrandGuideline');

const router = express.Router();
const CATEGORIES = [
  'TONE',
  'TERMINOLOGY',
  'FACTS',
  'CLAIMS',
  'MESSAGING',
  'RESTRICTED_WORDS',
  'BRANDING',
  'ACCESSIBILITY',
];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];

function normalizeTerms(value) {
  const terms = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const uniqueTerms = new Map();

  terms
    .flatMap((term) => typeof term === 'string' ? term.split(',') : [])
    .map((term) => term.trim())
    .filter(Boolean)
    .forEach((term) => {
      const key = term.toLocaleLowerCase();
      if (!uniqueTerms.has(key)) uniqueTerms.set(key, term);
    });

  return Array.from(uniqueTerms.values());
}

function normalizeGuidelines(value, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value)) return null;

  const guidelines = [];
  for (const guideline of value) {
    if (
      !guideline
      || !CATEGORIES.includes(guideline.category)
      || typeof guideline.title !== 'string'
      || !guideline.title.trim()
      || (guideline.description !== undefined && typeof guideline.description !== 'string')
      || (guideline.rule !== undefined && typeof guideline.rule !== 'string')
      || (guideline.examples !== undefined && typeof guideline.examples !== 'string')
      || (guideline.severity !== undefined && !SEVERITIES.includes(guideline.severity))
      || (guideline.active !== undefined && typeof guideline.active !== 'boolean')
    ) {
      return null;
    }

    guidelines.push({
      ...(mongoose.isValidObjectId(guideline._id) ? { _id: guideline._id } : {}),
      category: guideline.category,
      title: guideline.title.trim(),
      description: typeof guideline.description === 'string' ? guideline.description.trim() : '',
      rule: typeof guideline.rule === 'string' ? guideline.rule.trim() : '',
      examples: typeof guideline.examples === 'string' ? guideline.examples.trim() : '',
      severity: guideline.severity || 'MEDIUM',
      active: guideline.active !== false,
    });
  }
  return guidelines;
}

function normalizeProfileInput(body, current = {}) {
  const profile = {
    name: typeof body.name === 'string' ? body.name.trim() : current.name,
    description: typeof body.description === 'string'
      ? body.description.trim()
      : current.description,
    toneOfVoice: typeof body.toneOfVoice === 'string'
      ? body.toneOfVoice.trim()
      : current.toneOfVoice,
    preferredTerminology: body.preferredTerminology === undefined
      ? current.preferredTerminology || []
      : normalizeTerms(body.preferredTerminology),
    termsRequiringReview: body.termsRequiringReview === undefined
      ? current.termsRequiringReview || []
      : normalizeTerms(body.termsRequiringReview),
    guidelines: normalizeGuidelines(body.guidelines, current.guidelines || []),
  };

  if (
    !profile.name
    || !profile.description
    || !profile.toneOfVoice
    || profile.guidelines === null
  ) {
    return null;
  }
  return profile;
}

async function migrateLegacyGuidelines() {
  const [profiles, legacyGuidelines] = await Promise.all([
    BrandGuideline.find({ type: 'profile' }),
    BrandGuideline.collection.find({ type: 'guideline' }).toArray(),
  ]);
  if (!profiles.length || !legacyGuidelines.length) return;

  for (const profile of profiles) {
    const embeddedIds = new Set(profile.guidelines.map((guideline) => String(guideline._id)));
    for (const guideline of legacyGuidelines) {
      if (embeddedIds.has(String(guideline._id))) continue;
      profile.guidelines.push({
        _id: guideline._id,
        category: guideline.category,
        title: guideline.title,
        description: guideline.description || '',
        rule: guideline.rule || '',
        examples: guideline.examples || '',
        severity: SEVERITIES.includes(guideline.severity) ? guideline.severity : 'MEDIUM',
        active: guideline.active !== false,
      });
    }
    await profile.save();
  }

  await BrandGuideline.collection.deleteMany({
    _id: { $in: legacyGuidelines.map((guideline) => guideline._id) },
  });
}

function nextVersion(version) {
  const [major, minor] = String(version || '1.0').split('.').map(Number);
  return `${Number.isFinite(major) ? major : 1}.${(Number.isFinite(minor) ? minor : 0) + 1}`;
}

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    await migrateLegacyGuidelines();
    const filter = { type: 'profile' };
    if (req.user.role !== 'ADMIN') filter.isActive = { $ne: false };
    const profiles = await BrandGuideline.find(filter).sort({ name: 1 });
    res.json(profiles);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await migrateLegacyGuidelines();
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid brand profile ID' });
    }
    const filter = { _id: req.params.id, type: 'profile' };
    if (req.user.role !== 'ADMIN') filter.isActive = { $ne: false };
    const profile = await BrandGuideline.findOne(filter);
    if (!profile) return res.status(404).json({ message: 'Brand profile not found' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.post('/', role('ADMIN'), async (req, res, next) => {
  try {
    const profileData = normalizeProfileInput({
      ...req.body,
      preferredTerminology: req.body.preferredTerminology ?? [],
      termsRequiringReview: req.body.termsRequiringReview ?? [],
    });
    if (!profileData) {
      const message = req.body.guidelines !== undefined
        ? 'Each guideline must include a valid category and title, with valid optional fields'
        : 'Brand name, description, and tone of voice are required';
      return res.status(400).json({ message });
    }
    const profile = new BrandGuideline({
      ...profileData,
      type: 'profile',
      version: '1.0',
      isActive: true,
    });
    await profile.save();
    await migrateLegacyGuidelines();
    const savedProfile = await BrandGuideline.findById(profile._id);
    res.status(201).json(savedProfile);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', role('ADMIN'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid brand profile ID' });
    }
    const profile = await BrandGuideline.findOne({
      _id: req.params.id,
      type: 'profile',
    });
    if (!profile) return res.status(404).json({ message: 'Brand profile not found' });

    if (req.body.isActive !== undefined && typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean' });
    }
    const profileData = normalizeProfileInput({
      ...req.body,
      preferredTerminology: req.body.preferredTerminology
        ?? profile.preferredTerminology,
      termsRequiringReview: req.body.termsRequiringReview
        ?? profile.termsRequiringReview,
    }, profile);
    if (!profileData) {
      const message = req.body.guidelines !== undefined
        ? 'Each guideline must include a valid category and title, with valid optional fields'
        : 'Brand name, description, and tone of voice are required';
      return res.status(400).json({
        message,
      });
    }

    const changed = [
      'name',
      'description',
      'toneOfVoice',
      'preferredTerminology',
      'termsRequiringReview',
      'guidelines',
    ]
      .some((field) => JSON.stringify(profile[field]) !== JSON.stringify(profileData[field]));
    Object.assign(profile, profileData);
    if (changed) profile.version = nextVersion(profile.version);
    if (req.body.isActive !== undefined) profile.isActive = req.body.isActive;
    await profile.save();
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', role('ADMIN'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid brand profile ID' });
    }
    const profile = await BrandGuideline.findOneAndUpdate(
      { _id: req.params.id, type: 'profile' },
      { $set: { isActive: false, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!profile) return res.status(404).json({ message: 'Brand profile not found' });
    res.json({ message: 'Brand profile deactivated', profile });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
