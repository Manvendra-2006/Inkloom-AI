// backend/src/services/social/tokenService.js
const crypto = require('crypto');
const config = require('../../config');

// Simple reversible encryption for demo (AES-256-CBC). In production use a proper KMS.
const algorithm = 'aes-256-cbc';
const key = crypto.createHash('sha256').update(config.JWT_SECRET).digest(); // derive from JWT secret
const ivLength = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(ciphertext) {
  const [ivHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
