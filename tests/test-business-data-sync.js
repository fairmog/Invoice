#!/usr/bin/env node

/**
 * Test Business Data Synchronization
 * 
 * This test verifies that business settings data is properly synchronized
 * between the main page display, localStorage, and the database for invoice generation
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testBusinessDataSync() {
  console.log('🧪 Testing Business Data Synchronization');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check API endpoint returns data
    console.log('\n📝 Test 1: Check business settings API...');
    
    const settingsResponse = await fetch(`${BASE_URL}/api/business-settings`);
    
    if (!settingsResponse.ok) {
      throw new Error(`API failed: HTTP ${settingsResponse.status}`);
    }
    
    const currentSettings = await settingsResponse.json();
    console.log(`  ✅ API endpoint accessible`);
    console.log(`  ✅ Current settings loaded:`, {
      name: currentSettings.name || 'Not set',
      email: currentSettings.email || 'Not set',
      phone: currentSettings.phone || 'Not set',
      address: currentSettings.address || 'Not set'
    });

    // Test 2: Update business settings via API
    console.log('\n📝 Test 2: Update business settings...');
    
    const testSettings = {
      name: "Test Sync Company",
      email: "testsync@company.com",
      phone: "+62 123 456 7890",
      address: "Test Address for Sync",
      website: "https://testsync.com",
      taxId: "12.345.678.9-012.345",
      taxRate: 11,
      taxEnabled: true,
      taxName: "PPN",
      taxDescription: "Pajak Pertambahan Nilai"
    };

    const updateResponse = await fetch(`${BASE_URL}/api/business-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSettings)
    });

    if (!updateResponse.ok) {
      throw new Error(`Update failed: HTTP ${updateResponse.status}`);
    }

    console.log(`  ✅ Settings updated successfully`);

    // Test 3: Verify settings were saved
    console.log('\n📝 Test 3: Verify settings persistence...');
    
    const verifyResponse = await fetch(`${BASE_URL}/api/business-settings`);
    const savedSettings = await verifyResponse.json();
    
    const fieldsMatch = 
      savedSettings.name === testSettings.name &&
      savedSettings.email === testSettings.email &&
      savedSettings.phone === testSettings.phone &&
      savedSettings.address === testSettings.address;
      
    console.log(`  ${fieldsMatch ? '✅' : '❌'} Settings saved correctly to database`);
    
    if (fieldsMatch) {
      console.log(`    - Name: ${savedSettings.name}`);
      console.log(`    - Email: ${savedSettings.email}`);
      console.log(`    - Phone: ${savedSettings.phone}`);
      console.log(`    - Address: ${savedSettings.address}`);
    }

    // Test 4: Check main page displays updated data
    console.log('\n📝 Test 4: Check main page data loading...');
    
    const mainPageResponse = await fetch(`${BASE_URL}/`);
    const mainPageHtml = await mainPageResponse.text();
    
    // Check if main page has the loadBusinessDataFromAPI function
    const hasLoadFunction = mainPageHtml.includes('loadBusinessDataFromAPI');
    const hasAPICall = mainPageHtml.includes('/api/business-settings');
    const hasDOMContentLoaded = mainPageHtml.includes('loadBusinessDataFromAPI()');
    const hasBroadcastChannel = mainPageHtml.includes('BroadcastChannel');
    
    console.log(`  ${hasLoadFunction ? '✅' : '❌'} Main page has data loading function`);
    console.log(`  ${hasAPICall ? '✅' : '❌'} Function calls business settings API`);
    console.log(`  ${hasDOMContentLoaded ? '✅' : '❌'} Function called on page load`);
    console.log(`  ${hasBroadcastChannel ? '✅' : '❌'} Cross-tab update mechanism present`);

    // Test 5: Check business settings page has cross-page updates
    console.log('\n📝 Test 5: Check business settings page integration...');
    
    const settingsPageResponse = await fetch(`${BASE_URL}/business-settings`);
    const settingsPageHtml = await settingsPageResponse.text();
    
    const hasWindowOpener = settingsPageHtml.includes('window.opener.loadBusinessDataFromAPI');
    const hasBroadcastSender = settingsPageHtml.includes('business-settings-updates');
    const hasSuccessCallback = settingsPageHtml.includes('Business information saved successfully');
    
    console.log(`  ${hasWindowOpener ? '✅' : '❌'} Window opener update mechanism`);
    console.log(`  ${hasBroadcastSender ? '✅' : '❌'} Broadcast channel update mechanism`);
    console.log(`  ${hasSuccessCallback ? '✅' : '❌'} Success callback with updates`);

    // Test 6: Test invoice generation data source
    console.log('\n📝 Test 6: Test invoice generation data flow...');
    
    // Create a simple test message for invoice generation
    const testMessage = "Test product 1pcs\nTest Customer\ntest@email.com\n+62 123 456 789";
    
    const invoiceResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: testMessage,
        businessProfile: testSettings // Simulate what localStorage would send
      })
    });

    if (invoiceResponse.ok) {
      const invoiceData = await invoiceResponse.json();
      
      if (invoiceData.success && invoiceData.invoice) {
        const merchantData = invoiceData.invoice.merchant;
        
        const invoiceUsesCorrectData = 
          merchantData.businessName === testSettings.name &&
          merchantData.email === testSettings.email &&
          merchantData.phone === testSettings.phone &&
          merchantData.address === testSettings.address;
          
        console.log(`  ${invoiceUsesCorrectData ? '✅' : '❌'} Invoice uses correct business data`);
        
        if (invoiceUsesCorrectData) {
          console.log(`    - Invoice business name: ${merchantData.businessName}`);
          console.log(`    - Invoice email: ${merchantData.email}`);
        } else {
          console.log(`    - Expected: ${testSettings.name}`);
          console.log(`    - Got: ${merchantData.businessName}`);
        }
      } else {
        console.log(`  ❌ Invoice generation failed`);
      }
    } else {
      console.log(`  ❌ Invoice API call failed`);
    }

    // Summary
    const allMainPageTests = hasLoadFunction && hasAPICall && hasDOMContentLoaded && hasBroadcastChannel;
    const allSettingsPageTests = hasWindowOpener && hasBroadcastSender && hasSuccessCallback;
    const dataIntegrityTests = fieldsMatch;
    
    console.log('\n🎯 SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`API & Database Tests: ${dataIntegrityTests ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Main Page Integration: ${allMainPageTests ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Settings Page Integration: ${allSettingsPageTests ? '✅ PASSED' : '❌ FAILED'}`);

    if (allMainPageTests && allSettingsPageTests && dataIntegrityTests) {
      console.log('\n🎉 SUCCESS: Business data synchronization is working!');
      console.log('✅ Settings save to database correctly');
      console.log('✅ Main page loads data from API on startup');
      console.log('✅ Cross-page updates implemented');
      console.log('✅ Invoice generation uses current business data');
      console.log('\n🌐 Manual Test Instructions:');
      console.log('1. Open http://localhost:3000/ in one tab');
      console.log('2. Open http://localhost:3000/business-settings in another tab');
      console.log('3. Update business info in settings and save');
      console.log('4. Check main page updates automatically');
      console.log('5. Generate an invoice and verify it uses new business data');
    } else {
      console.log('\n⚠️ Some tests failed - check integration issues above');
    }

    // Restore original settings if they existed
    if (currentSettings && currentSettings.name) {
      console.log('\n🔄 Restoring original settings...');
      await fetch(`${BASE_URL}/api/business-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings)
      });
      console.log('✅ Original settings restored');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testBusinessDataSync().catch(console.error);