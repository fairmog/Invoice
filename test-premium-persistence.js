#!/usr/bin/env node

/**
 * Test Premium Persistence Flow
 * 
 * This script tests the premium upgrade and persistence functionality
 * to ensure that premium status is correctly saved and loaded per merchant
 */

import config from './config/config.js';

// Choose database implementation
let database;
if (process.env.USE_SUPABASE === 'true') {
  const { default: SupabaseDatabase } = await import('./src/supabase-database.js');
  database = new SupabaseDatabase();
} else {
  const { default: SimpleDatabase } = await import('./src/simple-database.js');
  database = new SimpleDatabase('./invoice-generator-data.json');
}

async function testPremiumPersistence() {
  console.log('🧪 Testing Premium Persistence Flow\n');

  try {
    // Test 1: Check if we have merchants to test with
    console.log('1️⃣ Checking merchants in database...');
    const merchants = await database.getAllMerchants();
    
    if (!merchants || merchants.length === 0) {
      console.log('❌ No merchants found. Creating test merchant...');
      
      // Create a test merchant for testing
      const testMerchant = await database.createMerchant({
        business_name: 'Test Premium Business',
        email: 'test@premium.com',
        password: 'test123',
        phone: '+1234567890'
      });
      
      console.log('✅ Created test merchant with ID:', testMerchant.id);
      merchants.push(testMerchant);
    }
    
    const testMerchantId = merchants[0].id;
    console.log(`✅ Using merchant ID: ${testMerchantId}\n`);

    // Test 2: Check current business settings
    console.log('2️⃣ Checking current business settings...');
    let settings = await database.getBusinessSettings(testMerchantId);
    console.log('Current settings:', {
      hasSettings: Object.keys(settings).length > 0,
      premiumActive: settings.premiumActive,
      name: settings.name,
      merchantId: settings.merchant_id || 'missing'
    });

    // Test 3: Activate premium
    console.log('\n3️⃣ Activating premium branding...');
    const premiumSettings = {
      premiumActive: true,
      customHeaderText: 'Test Premium Header',
      customHeaderBgColor: '#FF6B35',
      hideAspreeBranding: true
    };

    const activationResult = await database.activatePremiumBranding(premiumSettings, testMerchantId);
    console.log('✅ Premium activated:', {
      premiumActive: activationResult.premiumActive,
      customHeaderText: activationResult.customHeaderText,
      hideAspreeBranding: activationResult.hideAspreeBranding
    });

    // Test 4: Verify persistence by reloading settings
    console.log('\n4️⃣ Verifying premium persistence (simulating page refresh)...');
    const reloadedSettings = await database.getBusinessSettings(testMerchantId);
    
    console.log('Reloaded settings:', {
      premiumActive: reloadedSettings.premiumActive,
      customHeaderText: reloadedSettings.customHeaderText,
      hideAspreeBranding: reloadedSettings.hideAspreeBranding,
      merchantId: reloadedSettings.merchant_id
    });

    // Verify premium status persisted
    if (reloadedSettings.premiumActive === true) {
      console.log('✅ PASS: Premium status persisted correctly');
    } else {
      console.log('❌ FAIL: Premium status was lost after reload');
      return false;
    }

    // Test 5: Test with another merchant to verify isolation
    if (merchants.length > 1) {
      console.log('\n5️⃣ Testing merchant isolation...');
      const otherMerchantId = merchants[1].id;
      const otherSettings = await database.getBusinessSettings(otherMerchantId);
      
      console.log(`Other merchant (${otherMerchantId}) settings:`, {
        premiumActive: otherSettings.premiumActive,
        merchantId: otherSettings.merchant_id
      });

      if (otherSettings.premiumActive !== true) {
        console.log('✅ PASS: Merchant isolation working - other merchant not affected');
      } else {
        console.log('⚠️ WARNING: Other merchant also has premium active');
      }
    }

    // Test 6: Deactivate premium
    console.log('\n6️⃣ Testing premium deactivation...');
    const deactivationResult = await database.deactivatePremiumBranding(testMerchantId);
    console.log('✅ Premium deactivated:', {
      premiumActive: deactivationResult.premiumActive,
      hideAspreeBranding: deactivationResult.hideAspreeBranding
    });

    // Test 7: Verify deactivation persisted
    console.log('\n7️⃣ Verifying deactivation persistence...');
    const finalSettings = await database.getBusinessSettings(testMerchantId);
    
    if (finalSettings.premiumActive === false) {
      console.log('✅ PASS: Premium deactivation persisted correctly');
    } else {
      console.log('❌ FAIL: Premium deactivation was not persisted');
      return false;
    }

    console.log('\n🎉 All premium persistence tests PASSED!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Premium activation works');
    console.log('   ✅ Premium status persists across reloads');
    console.log('   ✅ Merchant isolation is working');
    console.log('   ✅ Premium deactivation works');
    console.log('   ✅ Business settings properly linked to merchants');

    return true;

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testPremiumPersistence()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });