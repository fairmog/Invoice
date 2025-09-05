#!/usr/bin/env node

/**
 * Test Zero Price Item Error
 * 
 * This test reproduces the error shown in the screenshot
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testZeroPriceError() {
  console.log('🐛 Testing Zero Price Item Error');
  console.log('=' .repeat(50));

  try {
    // Test message that might generate 0 price items
    const testMessage = `lolly 12pcs gratis
Customer: Test Customer
Phone: 08123456789
Address: Test Address`;

    const businessProfile = {
      name: "Test Store",
      email: "test@store.com", 
      phone: "08111222333",
      address: "Test Store Address"
    };

    console.log('📝 Testing with message that might have zero price items...');
    console.log('Message:', testMessage);
    
    // Generate preview
    const previewResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage, businessProfile })
    });

    const previewData = await previewResponse.json();
    
    if (!previewData.success) {
      console.error('❌ Preview failed:', previewData.error);
      
      // Check if this is the validation error we're looking for
      if (previewData.error && previewData.error.includes('Missing quantity or unitPrice')) {
        console.log('✅ Reproduced the error from the screenshot!');
        console.log('Error details:', previewData.error);
        
        // Let's also test another variation
        console.log('\n🔄 Testing another variation...');
        
        const testMessage2 = `lolly 12pcs harga 0
Customer: Test Customer
Phone: 08123456789  
Address: Test Address`;

        const previewResponse2 = await fetch(`${BASE_URL}/api/preview-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: testMessage2, businessProfile })
        });

        const previewData2 = await previewResponse2.json();
        
        if (!previewData2.success) {
          console.log('✅ Also reproduced with explicit "harga 0"');
          console.log('Error details:', previewData2.error);
        }
        
      }
      return;
    }
    
    console.log('✅ Preview succeeded (unexpected)');
    console.log('Items:', previewData.invoice.items.map(item => ({
      product: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal
    })));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testZeroPriceError().catch(console.error);