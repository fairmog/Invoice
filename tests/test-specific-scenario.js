#!/usr/bin/env node

/**
 * Test Specific Scenario
 * 
 * This test tries to reproduce the exact scenario that's showing all zeros
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testSpecificScenario() {
  console.log('🔍 Testing Specific Scenario That Shows All Zeros');
  console.log('=' .repeat(60));

  const businessProfile = {
    name: "Test Store",
    email: "test@store.com", 
    phone: "08111222333",
    address: "Test Store Address"
  };

  // Test various scenarios that might be causing the issue
  const testCases = [
    {
      name: 'Original Lolly Test (from screenshot)',
      message: `lolly 12pcs harga 50000
Customer: Test Customer
Phone: 08123456789
Address: Test Address`
    },
    {
      name: 'Simple Product with Price',
      message: `produk 1pcs harga 100000
Customer: Test Customer
Phone: 08123456789
Address: Test Address`
    },
    {
      name: 'Multiple Items',
      message: `laptop 1pc harga 10000000
mouse 1pc harga 500000
Customer: Test Customer
Phone: 08123456789
Address: Test Address`
    },
    {
      name: 'With Discount',
      message: `laptop 1pc harga 10000000
discount 10%
Customer: Test Customer
Phone: 08123456789
Address: Test Address`
    },
    {
      name: 'With Tax Context',
      message: `laptop 1pc harga 10000000
Customer: Test Customer
Phone: 08123456789
Address: Test Address`
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`📝 Message: ${testCase.message.split('\n')[0]}...`);
    
    try {
      const previewResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testCase.message, businessProfile })
      });

      const previewData = await previewResponse.json();
      
      if (!previewData.success) {
        console.log('❌ Failed:', previewData.error);
        continue;
      }
      
      const invoice = previewData.invoice;
      const calc = invoice.calculations;
      
      console.log(`   Items: ${invoice.items.length}`);
      invoice.items.forEach((item, i) => {
        console.log(`     ${i+1}. ${item.productName}: qty=${item.quantity}, price=${item.unitPrice}, total=${item.lineTotal}`);
      });
      
      console.log(`   💰 Subtotal: ${calc.subtotal}`);
      console.log(`   💰 Tax: ${calc.totalTax}`);
      console.log(`   💰 Discount: ${calc.discount}`);
      console.log(`   💰 Grand Total: ${calc.grandTotal}`);
      
      // Check for the "all zeros" problem
      const hasZeroIssue = (
        calc.subtotal === 0 && 
        invoice.items.some(item => item.unitPrice > 0)
      ) || (
        calc.subtotal > 0 && 
        calc.grandTotal === 0
      );
      
      if (hasZeroIssue) {
        console.log('   🚨 FOUND ZERO ISSUE!');
      } else {
        console.log('   ✅ Calculations look correct');
      }
      
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
  
  console.log('\n🔍 Please test with your exact input to see if the issue persists...');
}

// Run the test
testSpecificScenario().catch(console.error);