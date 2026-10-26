// models/Review.js
const mongoose = require('mongoose');

const actionEnum = ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'];

const reviewSchema = new mongoose.Schema({
  advertisementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertisement', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: actionEnum, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Review', reviewSchema);
