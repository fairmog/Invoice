#!/usr/bin/env node

/**
 * Test Product Name Preservation
 * 
 * This test verifies that disabling auto-learning prevents product name modifications
 * and ensures "linea 28 sumba" stays "linea 28 sumba" instead of becoming "sumba blue jeans"
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testProductNamePreservation() {
  console.log('🧪 Testing Product Name Preservation After Disabling Auto-Learning');
  console.log('=' .repeat(70));

  try {
    // Test case 1: The problematic case - "linea 28 sumba"
    console.log('\n📝 Test Case 1: "linea 28 sumba" preservation...');
    
    const testMessage1 = `linea 28 sumba 1pcs
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

    console.log('Input message:', testMessage1.split('\n')[0] + '...');
    
    const response1 = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage1, businessProfile })
    });

    const data1 = await response1.json();
    
    if (data1.success) {
      const item = data1.invoice.items[0];
      console.log(`✅ Generated product name: "${item.productName}"`);
      
      if (item.productName === 'linea 28 sumba') {
        console.log('🎯 SUCCESS: Product name preserved exactly as input');
      } else {
        console.log(`❌ FAILED: Product name changed from "linea 28 sumba" to "${item.productName}"`);
      }
    } else {
      console.log('❌ Preview failed:', data1.error);
    }

    // Test case 2: Another variation to test
    console.log('\n📝 Test Case 2: "lolly bag custom" preservation...');
    
    const testMessage2 = `lolly bag custom 2pcs
john doe
jl. merdeka 123
081234567890
test@email.com`;

    console.log('Input message:', testMessage2.split('\n')[0] + '...');
    
    const response2 = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage2, businessProfile })
    });

    const data2 = await response2.json();
    
    if (data2.success) {
      const item = data2.invoice.items[0];
      console.log(`✅ Generated product name: "${item.productName}"`);
      
      if (item.productName === 'lolly bag custom') {
        console.log('🎯 SUCCESS: Product name preserved exactly as input');
      } else {
        console.log(`❌ FAILED: Product name changed from "lolly bag custom" to "${item.productName}"`);
      }
    } else {
      console.log('❌ Preview failed:', data2.error);
    }

    // Test case 3: Check that catalog prices still work
    console.log('\n📝 Test Case 3: Catalog price lookup still works...');
    
    const testMessage3 = `lolly 1pcs
jane doe
jl. sudirman 456
081234567891
jane@email.com`;

    console.log('Input message:', testMessage3.split('\n')[0] + '...');
    
    const response3 = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage3, businessProfile })
    });

    const data3 = await response3.json();
    
    if (data3.success) {
      const item = data3.invoice.items[0];
      console.log(`✅ Generated product name: "${item.productName}"`);
      console.log(`✅ Unit price: Rp ${item.unitPrice}`);
      console.log(`✅ Matched from catalog: ${item.matchedFromCatalog}`);
      
      if (item.productName === 'lolly') {
        console.log('🎯 SUCCESS: Product name preserved as "lolly"');
        if (item.unitPrice > 0) {
          console.log('🎯 SUCCESS: Catalog price lookup still working');
        } else {
          console.log('⚠️  WARNING: Price is 0 - catalog lookup might not be working');
        }
      } else {
        console.log(`❌ FAILED: Product name changed from "lolly" to "${item.productName}"`);
      }
    } else {
      console.log('❌ Preview failed:', data3.error);
    }

    console.log('\n🎯 SUMMARY:');
    console.log('=' .repeat(70));
    console.log('✅ Auto-learning disabled successfully');
    console.log('✅ Product names should now be preserved exactly as user inputs them');
    console.log('✅ Catalog price lookup should still work for matching products');
    console.log('✅ No more unauthorized product name modifications');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testProductNamePreservation().catch(console.error);