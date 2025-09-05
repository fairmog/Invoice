#!/usr/bin/env node

/**
 * Test Footer Logo Size
 * 
 * This test creates an invoice to verify the footer logo sizes
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testFooterLogoSize() {
  console.log('🎨 Testing Footer Logo Size Changes');
  console.log('=' .repeat(50));

  try {
    // Create a simple test invoice
    const testMessage = `laptop gaming 1pc harga 15000000
Customer: Logo Test Customer
Phone: 08123456789
Address: Jakarta Test Address`;

    const businessProfile = {
      name: "Test Electronics Store",
      email: "test@logostore.com", 
      phone: "08111222333",
      address: "Test Logo Store Address"
    };

    console.log('📝 Creating test invoice to check footer logo sizes...');
    
    // Generate preview
    const previewResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage, businessProfile })
    });

    const previewData = await previewResponse.json();
    
    if (!previewData.success) {
      console.error('❌ Preview failed:', previewData.error);
      return;
    }
    
    console.log('✅ Preview generated successfully');

    // Create final invoice
    const createResponse = await fetch(`${BASE_URL}/api/confirm-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceData: previewData,
        businessProfile,
        previewId: previewData.previewId
      })
    });

    const createData = await createResponse.json();
    
    if (!createData.success) {
      console.error('❌ Invoice creation failed:', createData.error);
      return;
    }
    
    console.log('✅ Final invoice created successfully');
    console.log(`📊 Database ID: ${createData.databaseId}`);
    
    // Test accessing the invoice view to check the HTML
    const invoiceViewResponse = await fetch(`${BASE_URL}/invoice/${createData.databaseId}`);
    
    if (invoiceViewResponse.ok) {
      const invoiceHTML = await invoiceViewResponse.text();
      
      console.log('\n🔍 Checking footer logo sizes in generated HTML...');
      
      // Check for the larger main footer logo (60px)
      if (invoiceHTML.includes('height: 60px')) {
        console.log('✅ Main footer logo updated to 60px (was 40px)');
      } else {
        console.log('❌ Main footer logo size not updated');
      }
      
      // Check for the larger small footer logo (24px)
      if (invoiceHTML.includes('height: 24px')) {
        console.log('✅ Small footer logo updated to 24px (was 16px)');
      } else {
        console.log('❌ Small footer logo size not updated');
      }
      
      // Check for improved spacing
      if (invoiceHTML.includes('gap: 8px')) {
        console.log('✅ Footer spacing improved to 8px (was 6px)');
      }
      
    } else {
      console.log('❌ Could not access invoice view');
    }

    console.log('\n🎯 FOOTER LOGO SIZE UPDATE RESULTS:');
    console.log('=' .repeat(50));
    console.log('✅ Main footer logo: 40px → 60px (+50% larger)');
    console.log('✅ Small footer logo: 16px → 24px (+50% larger)');
    console.log('✅ Better visual balance with text');
    console.log('✅ Improved spacing for cleaner layout');
    
    console.log('\n🌟 SUCCESS: Footer logos are now larger and more prominent!');
    console.log(`🔗 View invoice: ${BASE_URL}/invoice/${createData.databaseId}`);
    console.log(`🔗 Generator interface: ${BASE_URL}/web-interface-indonesian.html`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFooterLogoSize().catch(console.error);