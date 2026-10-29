// config/index.js
const dotenv = require('dotenv');
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const frontendUrl = process.env.FRONTEND_URL
  || (isProduction ? 'https://inkloom-ai-eosin.vercel.app' : 'http://localhost:3000');
const additionalFrontendUrls = (process.env.ADDITIONAL_FRONTEND_URLS || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const localFrontendUrls = isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'];

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'https://inkloom-ai-2.onrender.com',
  CORS_ORIGINS: [...new Set([
    ...frontendUrl.split(',').map((url) => url.trim().replace(/\/+$/, '')).filter(Boolean),
    ...additionalFrontendUrls,
    ...localFrontendUrls,
  ])],
  AI_MODE: process.env.AI_MODE || 'prod',
  SOCIAL_MEDIA_MODE: process.env.SOCIAL_MEDIA_MODE || 'mock',
  // OAuth credentials (placeholders)
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI,
  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_REDIRECT_URI: process.env.META_REDIRECT_URI,
  X_CLIENT_ID: process.env.X_CLIENT_ID,
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
  X_REDIRECT_URI: process.env.X_REDIRECT_URI,
};
