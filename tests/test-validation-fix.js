#!/usr/bin/env node

/**
 * Test Validation Fix Comprehensive
 * 
 * This test verifies that the validation fix works correctly for all scenarios
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testValidationFix() {
  console.log('🧪 Testing Validation Fix - Comprehensive');
  console.log('=' .repeat(60));

  const businessProfile = {
    name: "Test Store",
    email: "test@store.com", 
    phone: "08111222333",
    address: "Test Store Address"
  };

  const testCases = [
    {
      name: 'Free Item (unitPrice: 0)',
      message: `lolly 5pcs gratis
Customer: Test Customer
Phone: 08123456789
Address: Test Address`,
      expectSuccess: true,
      description: 'Should allow items with unitPrice = 0'
    },
    {
      name: 'Explicit Zero Price',
      message: `sample product 3pcs harga 0
Customer: Test Customer  
Phone: 08123456789
Address: Test Address`,
      expectSuccess: true,
      description: 'Should allow explicitly stated zero price'
    },
    {
      name: 'Normal Paid Item',
      message: `laptop 1pc harga 10000000
Customer: Test Customer
Phone: 08123456789
Address: Test Address`,
      expectSuccess: true,
      description: 'Should continue working for normal paid items'
    },
    {
      name: 'Mixed Free and Paid Items',
      message: `laptop 1pc harga 10000000
mouse gratis 1pc
Customer: Test Customer
Phone: 08123456789  
Address: Test Address`,
      expectSuccess: true,
      description: 'Should handle mix of free and paid items'
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`📝 Description: ${testCase.description}`);
    
    try {
      const previewResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testCase.message, businessProfile })
      });

      const previewData = await previewResponse.json();
      
      if (testCase.expectSuccess) {
        if (previewData.success) {
          console.log('✅ PASS: Invoice generated successfully');
          console.log(`   Items: ${previewData.invoice.items.length}`);
          previewData.invoice.items.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.productName}: qty=${item.quantity}, price=${item.unitPrice}, total=${item.lineTotal}`);
          });
          passedTests++;
        } else {
          console.log('❌ FAIL: Expected success but got error:', previewData.error);
        }
      } else {
        if (!previewData.success) {
          console.log('✅ PASS: Correctly rejected invalid input');
          console.log(`   Error: ${previewData.error}`);
          passedTests++;
        } else {
          console.log('❌ FAIL: Expected error but got success');
        }
      }
      
    } catch (error) {
      console.log('❌ FAIL: Test threw exception:', error.message);
    }
  }

  console.log('\n🎯 TEST RESULTS:');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`📊 Success Rate: ${(passedTests/totalTests*100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🌟 ALL TESTS PASSED! Validation fix is working correctly.');
    console.log('✅ Zero price items are now supported');
    console.log('✅ Normal paid items still work');
    console.log('✅ Mixed scenarios work correctly');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the validation logic.');
  }
}

// Run the test
testValidationFix().catch(console.error);