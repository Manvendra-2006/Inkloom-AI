// utils/jwt.js
const jwt = require('jsonwebtoken');
const config = require('../config');

function generateToken(user) {
  const payload = {
    id: user._id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { generateToken };
