#!/usr/bin/env node
/**
 * Setup Script: Enable Payment Mode for Testing
 * Usage: node setup-payment-mode.js
 * 
 * This script:
 * 1. Disables free mode in the database (switches to payment mode)
 * 2. Verifies the database connection
 * 3. Confirms payment mode is now enabled
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const connectDB = require('./backend/config/db');
const SystemSetting = require('./backend/models/SystemSetting');

async function setupPaymentMode() {
  try {
    console.log('\n🔧 Payment Mode Setup Script\n');
    console.log('Connecting to MongoDB...');
    
    await connectDB();
    if (mongoose.connection.name !== 'daycare') {
      throw new Error('Refusing to change payment mode outside the daycare database.');
    }
    console.log('✅ Connected to MongoDB\n');

    // Get or create system settings
    let settings = await SystemSetting.findOne();
    if (!settings) {
      console.log('📝 Creating new system settings...');
      settings = new SystemSetting({ isFreeMode: false });
    }

    // Check current state
    const wasInFreeMode = settings.isFreeMode;
    console.log(`Current mode: ${wasInFreeMode ? '🎁 FREE MODE' : '💳 PAYMENT MODE'}\n`);

    // Enable payment mode
    if (wasInFreeMode) {
      console.log('Switching to Payment Mode...');
      settings.isFreeMode = false;
      await settings.save();
      console.log('✅ Payment mode enabled!\n');
    } else {
      console.log('ℹ️  System is already in Payment Mode\n');
    }

    // Verify change
    const updated = await SystemSetting.findOne();
    console.log(`Verification: ${updated.isFreeMode ? '🎁 FREE MODE' : '✅ PAYMENT MODE ACTIVE'}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Refresh your browser to see the changes');
    console.log('2. Navigate to Payments > Make Payment');
    console.log('3. Click "Generate Test Invoice" or wait for invoices to load');
    console.log('4. Test phone validation with formats like: 0912345678, +251912345678, 07xxxxxxxx');
    console.log('5. Test Chapa checkout in test mode\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('connect ECONNREFUSED')) {
      console.error('\n⚠️  MongoDB is not running. Make sure MongoDB is started:');
      console.error('   - Windows: net start MongoDB');
      console.error('   - Mac/Linux: brew services start mongodb-community');
      console.error('   - Or use: mongod');
    }
    process.exit(1);
  }
}

setupPaymentMode();
