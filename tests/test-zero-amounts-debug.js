#!/usr/bin/env node

/**
 * Debug Zero Amounts Issue
 * 
 * This test reproduces the exact scenario from the screenshot to debug why all amounts are 0
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testZeroAmountsDebug() {
  console.log('🐛 Debugging Zero Amounts Issue from Screenshot');
  console.log('=' .repeat(60));

  try {
    // Based on the screenshot, trying to reproduce the exact scenario
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

    console.log('📝 Testing with message that matches the screenshot...');
    console.log('Message:', testMessage);
    
    // Generate preview first
    console.log('\n🔄 Step 1: Generating preview...');
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
    
    const invoice = previewData.invoice;
    
    console.log('\n📊 PREVIEW ANALYSIS:');
    console.log('Items count:', invoice.items.length);
    invoice.items.forEach((item, index) => {
      console.log(`  Item ${index + 1}:`);
      console.log(`    - Product: ${item.productName}`);
      console.log(`    - Quantity: ${item.quantity} (type: ${typeof item.quantity})`);
      console.log(`    - Unit Price: ${item.unitPrice} (type: ${typeof item.unitPrice})`);
      console.log(`    - Line Total: ${item.lineTotal} (type: ${typeof item.lineTotal})`);
    });
    
    console.log('\nCalculations:');
    console.log(`  - Subtotal: ${invoice.calculations.subtotal}`);
    console.log(`  - Tax: ${invoice.calculations.totalTax}`);
    console.log(`  - Discount: ${invoice.calculations.discount}`);
    console.log(`  - Grand Total: ${invoice.calculations.grandTotal}`);
    
    // Identify the issue
    if (invoice.items.length > 0) {
      const firstItem = invoice.items[0];
      if (firstItem.quantity > 0 && firstItem.unitPrice === 0) {
        console.log('\n🔍 ISSUE FOUND: Unit price is 0 - this suggests AI is not extracting price');
        console.log('💡 This might be because the message doesn\'t include explicit price information');
      } else if (firstItem.lineTotal === 0 && firstItem.unitPrice > 0) {
        console.log('\n🔍 ISSUE FOUND: Line total calculation is failing');
      } else if (invoice.calculations.subtotal === 0 && firstItem.lineTotal > 0) {
        console.log('\n🔍 ISSUE FOUND: Subtotal calculation is failing');
      }
    }
    
    // Try with explicit price
    console.log('\n🔄 Step 2: Testing with explicit price...');
    const testMessageWithPrice = `lolly 13pcs harga 50000
christy
jalan mimosa 30 no 2 jakarta utara
087882880070
famrog@gmail.com`;

    const previewResponse2 = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessageWithPrice, businessProfile })
    });

    const previewData2 = await previewResponse2.json();
    
    if (previewData2.success) {
      console.log('✅ Preview with explicit price succeeded');
      const invoice2 = previewData2.invoice;
      console.log(`  - Unit Price: ${invoice2.items[0].unitPrice}`);
      console.log(`  - Line Total: ${invoice2.items[0].lineTotal}`);
      console.log(`  - Subtotal: ${invoice2.calculations.subtotal}`);
      console.log(`  - Grand Total: ${invoice2.calculations.grandTotal}`);
      
      if (invoice2.calculations.grandTotal > 0) {
        console.log('✅ Adding explicit price fixes the issue!');
        console.log('💡 The problem is that AI is not inferring price when not explicitly stated');
      }
    } else {
      console.log('❌ Preview with explicit price also failed:', previewData2.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testZeroAmountsDebug().catch(console.error);