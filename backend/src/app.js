const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { PORT } = require('./config');
const authRoutes = require('./routes/auth');
const adRoutes = require('./routes/advertisements');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const socialRoutes = require('./routes/social');
const brandProfileRoutes = require('./routes/brandProfiles');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/brand-profiles', brandProfileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/social', socialRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
