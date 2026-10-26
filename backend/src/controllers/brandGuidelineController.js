// backend/src/controllers/brandGuidelineController.js
const BrandGuideline = require('../models/BrandGuideline');
const { validationResult } = require('express-validator');

// List all guidelines (admin only)
async function listGuidelines(req, res, next) {
  try {
    const guidelines = await BrandGuideline.find();
    res.json(guidelines);
  } catch (err) {
    next(err);
  }
}

// Create new guideline
async function createGuideline(req, res, next) {
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

// Update existing guideline
async function updateGuideline(req, res, next) {
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

// Delete guideline
async function deleteGuideline(req, res, next) {
  try {
    const result = await BrandGuideline.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Guideline not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listGuidelines,
  createGuideline,
  updateGuideline,
  deleteGuideline,
};
