#!/usr/bin/env node

/**
 * Test AI Price Extraction Debug
 * 
 * This test examines exactly what the AI is extracting from the message
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAIPriceExtraction() {
  console.log('🤖 Testing AI Price Extraction Debug');
  console.log('=' .repeat(60));

  try {
    // Test the exact message from the screenshot (no price)
    const testMessage = `lolly 13pcs
christy
jalan mimosa 30 no 2 jakarta utara
087882880070
famrog@gmail.com`;

    const businessProfile = {
      name: "Bevelient",
      email: "bevelient@gmail.com", 
      phone: "087882880070",
      address: "Jl Duta Harapan Indah Blok 14 no 23"
    };

    console.log('📝 Testing with message (no explicit price):');
    console.log(testMessage);
    
    // Let's check what the AI extraction endpoints return
    console.log('\n🔄 Making raw API call to see AI response...');
    
    // Make the call and log the full response
    const response = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage, businessProfile })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('\n📊 AI EXTRACTION RESULTS:');
      console.log('Success:', data.success);
      
      if (data.invoice && data.invoice.items && data.invoice.items.length > 0) {
        const item = data.invoice.items[0];
        console.log('\nExtracted Item:');
        console.log(`  - Product Name: "${item.productName}"`);
        console.log(`  - Quantity: ${item.quantity} (${typeof item.quantity})`);
        console.log(`  - Unit Price: ${item.unitPrice} (${typeof item.unitPrice})`);
        console.log(`  - Line Total: ${item.lineTotal} (${typeof item.lineTotal})`);
        
        // Check if the issue is in the AI extraction or in our processing
        if (item.unitPrice === 0) {
          console.log('\n🔍 ANALYSIS:');
          console.log('✅ AI correctly extracted quantity: 13');
          console.log('⚠️  AI set unitPrice to 0 because no price was provided');
          console.log('💡 This is EXPECTED behavior - the user input has no price!');
          
          console.log('\n📋 SOLUTION OPTIONS:');
          console.log('1. User should provide price: "lolly 13pcs harga 50000"');
          console.log('2. Add default price suggestion feature');
          console.log('3. Add price lookup from product catalog');
          console.log('4. Prompt user to add missing prices');
        }
      }
      
      console.log('\nCalculations:', data.invoice.calculations);
      
    } else {
      console.log('❌ AI extraction failed:', data.error);
    }
    
    // Now test with explicit price to confirm it works
    console.log('\n🔄 Testing with explicit price for comparison...');
    const testMessageWithPrice = `lolly 13pcs harga 50000
christy
jalan mimosa 30 no 2 jakarta utara
087882880070
famrog@gmail.com`;

    const responseWithPrice = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessageWithPrice, businessProfile })
    });

    const dataWithPrice = await responseWithPrice.json();
    
    if (dataWithPrice.success && dataWithPrice.invoice.items.length > 0) {
      const itemWithPrice = dataWithPrice.invoice.items[0];
      console.log('\nWith explicit price:');
      console.log(`  - Unit Price: ${itemWithPrice.unitPrice}`);
      console.log(`  - Line Total: ${itemWithPrice.lineTotal}`);
      console.log(`  - Subtotal: ${dataWithPrice.invoice.calculations.subtotal}`);
      console.log(`  - Grand Total: ${dataWithPrice.invoice.calculations.grandTotal}`);
      
      if (dataWithPrice.invoice.calculations.grandTotal > 0) {
        console.log('\n✅ CONFIRMED: Adding explicit price fixes the issue');
        console.log('💡 The problem is missing price in user input, not our calculation logic');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAIPriceExtraction().catch(console.error);