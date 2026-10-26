// resetAdminPassword.js
// Utility script to update the admin user's password (hashed via pre-save hook)
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../src/models/User');

async function reset() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const adminEmail = 'admin@inkloom.ai';
    const newPlainPassword = 'Admin@123'; // desired password
    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.error('Admin user not found');
      process.exit(1);
    }
    admin.passwordHash = newPlainPassword; // pre-save hook will hash on save
    await admin.save();
    console.log('Admin password updated successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error updating admin password:', err);
    process.exit(1);
  }
}

reset();
