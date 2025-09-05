#!/usr/bin/env node

/**
 * Test Settings Button Navigation
 * 
 * This test verifies that the settings button on the Aspree invoice generator page
 * correctly links to the merchant dashboard settings page
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testSettingsNavigation() {
  console.log('🧪 Testing Settings Button Navigation');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check main page loads and contains the settings link
    console.log('\n📝 Test 1: Check main page contains settings link...');
    
    const mainPageResponse = await fetch(`${BASE_URL}/`);
    
    if (!mainPageResponse.ok) {
      throw new Error(`Main page failed to load: HTTP ${mainPageResponse.status}`);
    }
    
    const mainPageHtml = await mainPageResponse.text();
    
    // Check for the settings link
    const hasSettingsLink = /href="\/business-settings".*?⚙️.*?Settings/s.test(mainPageHtml);
    const isLinkNotButton = /<a[^>]*href="\/business-settings"[^>]*class="edit-btn"/s.test(mainPageHtml);
    const noOldSettingsButton = !/<button[^>]*onclick="openBusinessProfile\(\)"[^>]*>[\s\S]*?⚙️[\s\S]*?Settings/s.test(mainPageHtml);
    
    console.log(`  ${hasSettingsLink ? '✅' : '❌'} Settings link found with correct href`);
    console.log(`  ${isLinkNotButton ? '✅' : '❌'} Settings is now a link (not button)`);
    console.log(`  ${noOldSettingsButton ? '✅' : '❌'} Old settings button with modal removed`);

    // Test 2: Check business settings page is accessible
    console.log('\n📝 Test 2: Check business settings page accessibility...');
    
    const settingsResponse = await fetch(`${BASE_URL}/business-settings`);
    
    if (!settingsResponse.ok) {
      throw new Error(`Settings page failed to load: HTTP ${settingsResponse.status}`);
    }
    
    const settingsHtml = await settingsResponse.text();
    
    // Check for tabbed interface elements from our previous implementation
    const hasTabsContainer = settingsHtml.includes('tabs-container');
    const hasBusinessInfoTab = settingsHtml.includes('🏢 Business Info');
    const hasPaymentMethodsTab = settingsHtml.includes('💳 Payment Methods');
    const hasAccountSettingsTab = settingsHtml.includes('👤 Account Settings');
    const hasEmailSetupTab = settingsHtml.includes('📧 Email & Setup');
    
    console.log(`  ${settingsResponse.ok ? '✅' : '❌'} Business settings page loads successfully`);
    console.log(`  ${hasTabsContainer ? '✅' : '❌'} Tabbed interface present`);
    console.log(`  ${hasBusinessInfoTab ? '✅' : '❌'} Business Info tab present`);
    console.log(`  ${hasPaymentMethodsTab ? '✅' : '❌'} Payment Methods tab present`);
    console.log(`  ${hasAccountSettingsTab ? '✅' : '❌'} Account Settings tab present`);
    console.log(`  ${hasEmailSetupTab ? '✅' : '❌'} Email & Setup tab present`);

    // Test 3: Check navigation consistency
    console.log('\n📝 Test 3: Check navigation consistency...');
    
    const hasBackToDashboard = settingsHtml.includes('← Back to Dashboard');
    const hasSettingsActive = settingsHtml.includes('⚙️ Settings');
    
    console.log(`  ${hasBackToDashboard ? '✅' : '❌'} Back to dashboard link present`);
    console.log(`  ${hasSettingsActive ? '✅' : '❌'} Settings navigation active state`);

    // Test 4: Check CSS styling consistency  
    console.log('\n📝 Test 4: Check CSS styling consistency...');
    
    const hasEditBtnClass = /href="\/business-settings".*?class="edit-btn"/s.test(mainPageHtml);
    const hasInlineFlexDisplay = /display:\s*inline-flex/s.test(mainPageHtml);
    const hasGearIcon = /⚙️.*?Settings/s.test(mainPageHtml);
    
    console.log(`  ${hasEditBtnClass ? '✅' : '❌'} Edit button CSS class preserved`);
    console.log(`  ${hasInlineFlexDisplay ? '✅' : '❌'} Inline flex display applied`);
    console.log(`  ${hasGearIcon ? '✅' : '❌'} Gear icon and text preserved`);

    // Summary
    const allMainPageTests = hasSettingsLink && isLinkNotButton && noOldSettingsButton;
    const allSettingsPageTests = settingsResponse.ok && hasTabsContainer && hasBusinessInfoTab && hasPaymentMethodsTab;
    const allNavigationTests = hasBackToDashboard && hasSettingsActive;
    const allStylingTests = hasEditBtnClass && hasInlineFlexDisplay && hasGearIcon;
    
    console.log('\n🎯 SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`Main Page Tests: ${allMainPageTests ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Settings Page Tests: ${allSettingsPageTests ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Navigation Tests: ${allNavigationTests ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Styling Tests: ${allStylingTests ? '✅ PASSED' : '❌ FAILED'}`);

    if (allMainPageTests && allSettingsPageTests && allNavigationTests && allStylingTests) {
      console.log('\n🎉 SUCCESS: Settings button navigation is working perfectly!');
      console.log('✅ Settings button now links directly to business-settings page');
      console.log('✅ Tabbed interface loads correctly');
      console.log('✅ Navigation flow is consistent');
      console.log('✅ Visual styling is preserved');
      console.log('\n🌐 Manual Test: Visit http://localhost:3000/ and click the Settings button');
    } else {
      console.log('\n⚠️ Some tests failed - check the issues above');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testSettingsNavigation().catch(console.error);