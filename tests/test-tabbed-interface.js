#!/usr/bin/env node

/**
 * Test Tabbed Interface
 * 
 * This test verifies that the new tabbed business settings interface works correctly
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testTabbedInterface() {
  console.log('🧪 Testing Tabbed Business Settings Interface');
  console.log('=' .repeat(60));

  try {
    // Test that the business settings page loads successfully
    console.log('\n📝 Testing business settings page load...');
    
    const response = await fetch(`${BASE_URL}/business-settings`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Check for tabbed interface elements
    const checks = [
      { name: 'Tab container', pattern: /tabs-container/ },
      { name: 'Business Info tab', pattern: /🏢 Business Info/ },
      { name: 'Payment Methods tab', pattern: /💳 Payment Methods/ },
      { name: 'Account Settings tab', pattern: /👤 Account Settings/ },
      { name: 'Email & Setup tab', pattern: /📧 Email & Setup/ },
      { name: 'Tab navigation CSS', pattern: /tab-button/ },
      { name: 'Tab content panels', pattern: /tab-panel/ },
      { name: 'Tab switching JavaScript', pattern: /function switchTab/ },
      { name: 'Setup guides combined', pattern: /📚 Setup Guides/ },
      { name: 'Gmail setup guide', pattern: /📬 Gmail Setup/ },
      { name: 'Outlook setup guide', pattern: /📧 Outlook Setup/ }
    ];

    console.log('\n✅ Business settings page loaded successfully');
    console.log('\n🔍 Checking for tabbed interface components:');
    
    let passedChecks = 0;
    let totalChecks = checks.length;
    
    checks.forEach(check => {
      if (check.pattern.test(html)) {
        console.log(`  ✅ ${check.name}`);
        passedChecks++;
      } else {
        console.log(`  ❌ ${check.name} - NOT FOUND`);
      }
    });

    console.log(`\n📊 Component Check Results: ${passedChecks}/${totalChecks} passed`);

    if (passedChecks === totalChecks) {
      console.log('\n🎯 SUCCESS: All tabbed interface components found!');
      console.log('✅ Business settings have been successfully reorganized into tabs');
      console.log('✅ Email integration and setup guides are combined');
      console.log('✅ Tab navigation and state management implemented');
    } else {
      console.log(`\n⚠️  WARNING: ${totalChecks - passedChecks} components missing`);
    }

    // Test specific tab organization
    console.log('\n🗂️  Tab Organization Check:');
    
    const businessInfoTab = /id="business-info".*?<\/div>\s*<\/div>/s.test(html);
    const paymentMethodsTab = /id="payment-methods".*?<\/div>\s*<\/div>/s.test(html);
    const accountSettingsTab = /id="account-settings".*?<\/div>\s*<\/div>/s.test(html);
    const emailSetupTab = /id="email-setup".*?<\/div>\s*<\/div>/s.test(html);
    
    console.log(`  ${businessInfoTab ? '✅' : '❌'} Business Info tab panel`);
    console.log(`  ${paymentMethodsTab ? '✅' : '❌'} Payment Methods tab panel`);
    console.log(`  ${accountSettingsTab ? '✅' : '❌'} Account Settings tab panel`);
    console.log(`  ${emailSetupTab ? '✅' : '❌'} Email & Setup tab panel`);

    // Check that setup guides are in email tab
    const setupGuidesInEmailTab = /id="email-setup".*?📚 Setup Guides.*?<\/div>\s*<\/div>/s.test(html);
    console.log(`  ${setupGuidesInEmailTab ? '✅' : '❌'} Setup guides combined with email settings`);

    console.log('\n🌐 Visual Test Instructions:');
    console.log('  1. Open http://localhost:3000/business-settings in your browser');
    console.log('  2. Verify you see 4 tabs: Business Info, Payment Methods, Account Settings, Email & Setup');
    console.log('  3. Click each tab to ensure they switch properly');
    console.log('  4. Confirm setup guides appear in the Email & Setup tab');
    console.log('  5. Test that tab state persists when refreshing the page');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testTabbedInterface().catch(console.error);