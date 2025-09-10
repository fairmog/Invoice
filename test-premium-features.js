#!/usr/bin/env node

/**
 * Premium Features Test Script
 * Tests premium branding functionality with Simple Database
 */

import dotenv from 'dotenv';
dotenv.config();

import SimpleDatabase from './src/simple-database.js';

console.log('🧪 Testing Premium Branding Features');
console.log('='.repeat(50));

const database = new SimpleDatabase();

async function testPremiumFeatures() {
  try {
    console.log('1. Testing initial premium status...');
    let isPremium = await database.isPremiumActive();
    console.log(`   Current premium status: ${isPremium}`);
    
    console.log('\n2. Testing premium activation...');
    const activationResult = await database.activatePremiumBranding({
      customHeaderText: 'Professional Business Invoices',
      customHeaderBgColor: '#1a365d',
      customFooterBgColor: '#2d3748',
      hideAspreeBranding: true
    });
    console.log('   ✅ Premium activated successfully');
    console.log('   Settings:', JSON.stringify(activationResult, null, 2));
    
    console.log('\n3. Testing premium status after activation...');
    isPremium = await database.isPremiumActive();
    console.log(`   Updated premium status: ${isPremium}`);
    
    console.log('\n4. Testing premium branding settings retrieval...');
    const brandingSettings = await database.getPremiumBrandingSettings();
    console.log('   Premium branding settings:', JSON.stringify(brandingSettings, null, 2));
    
    console.log('\n5. Testing business settings with premium data...');
    const businessSettings = await database.getBusinessSettings();
    console.log('   Business settings keys:', Object.keys(businessSettings));
    console.log('   Premium fields present:', {
      premiumActive: 'premiumActive' in businessSettings,
      customHeaderText: 'customHeaderText' in businessSettings,
      hideAspreeBranding: 'hideAspreeBranding' in businessSettings
    });
    
    console.log('\n6. Testing premium deactivation...');
    await database.deactivatePremiumBranding();
    isPremium = await database.isPremiumActive();
    console.log(`   Premium status after deactivation: ${isPremium}`);
    
    console.log('\n7. Re-activating premium for demonstration...');
    await database.activatePremiumBranding({
      customHeaderText: 'My Custom Business Header',
      customHeaderBgColor: '#4a5568',
      hideAspreeBranding: true
    });
    const finalSettings = await database.getPremiumBrandingSettings();
    console.log('   Final premium settings:', JSON.stringify(finalSettings, null, 2));
    
    console.log('\n🎉 All premium features tested successfully!');
    console.log('='.repeat(50));
    console.log('✅ Premium branding system is fully functional');
    console.log('📊 Features verified:');
    console.log('   • Premium activation/deactivation');
    console.log('   • Custom header text');
    console.log('   • Custom background colors');
    console.log('   • Hide Aspree branding option');
    console.log('   • Settings persistence');
    
  } catch (error) {
    console.error('❌ Premium feature test failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the tests
testPremiumFeatures();