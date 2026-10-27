// backend/src/server.js
const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

const startServer = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
    app.listen(config.PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${config.PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
