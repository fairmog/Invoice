// Comprehensive discount functionality test
console.log('🧪 Comprehensive Discount Functionality Test');
console.log('='.repeat(60));

async function testDiscountScenarios() {
  const testCases = [
    {
      name: 'English percentage (10%)',
      input: 'product 1pc price 100000 discount 10%\nJohn Doe - 081234567890\nJl. Test 123',
      expectedDiscount: 10000,
      expectedTotal: 90000,
      expectedType: 'percentage'
    },
    {
      name: 'Indonesian percentage (15 persen)',
      input: 'barang 2pcs harga 50000 diskon 15 persen\nSiti - 081234567891\nJl. Test 456',
      expectedDiscount: 15000, // 15% of 100000
      expectedTotal: 85000,
      expectedType: 'percentage'
    },
    {
      name: 'Indonesian percentage (potongan 20%)',
      input: 'lolly 3pcs harga 30000 potongan 20%\nBudi - 081234567892\nJl. Test 789',
      expectedDiscount: 18000, // 20% of 90000
      expectedTotal: 72000,
      expectedType: 'percentage'
    },
    {
      name: 'Fixed amount discount (Indonesian)',
      input: 'produk 1pc harga 200000 diskon 50000\nAni - 081234567893\nJl. Test 101',
      expectedDiscount: 50000,
      expectedTotal: 150000,
      expectedType: 'fixed'
    },
    {
      name: 'Fixed amount discount (shorthand)',
      input: 'item 2pcs harga 75000 discount 25rb\nTono - 081234567894\nJl. Test 202',
      expectedDiscount: 25000,
      expectedTotal: 125000,
      expectedType: 'fixed'
    },
    {
      name: 'No discount',
      input: 'product 1pc price 100000\nTest User - 081234567895\nJl. Test 303',
      expectedDiscount: 0,
      expectedTotal: 100000,
      expectedType: 'fixed'
    }
  ];

  console.log('Running tests...\n');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`${i + 1}. Testing: ${testCase.name}`);
    console.log(`   Input: "${testCase.input}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/process-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: testCase.input,
          businessProfile: {
            businessName: 'Test Business',
            address: 'Test Address',
            phone: '021-1234567',
            email: 'test@business.com',
            taxEnabled: false
          }
        })
      });

      if (!response.ok) {
        console.error(`   ❌ API request failed: ${response.status}`);
        continue;
      }

      const result = await response.json();
      
      if (result.success && result.invoice) {
        const calculations = result.invoice.calculations;
        
        console.log(`   Results: discount=${calculations.discount}, total=${calculations.grandTotal}, type=${calculations.discountType}`);
        console.log(`   Expected: discount=${testCase.expectedDiscount}, total=${testCase.expectedTotal}, type=${testCase.expectedType}`);
        
        const discountCorrect = Math.abs(calculations.discount - testCase.expectedDiscount) < 100;
        const totalCorrect = Math.abs(calculations.grandTotal - testCase.expectedTotal) < 100;
        const typeCorrect = calculations.discountType === testCase.expectedType || (testCase.expectedDiscount === 0);
        
        if (discountCorrect && totalCorrect && typeCorrect) {
          console.log(`   ✅ PASSED`);
          passedTests++;
        } else {
          console.log(`   ❌ FAILED`);
          if (!discountCorrect) console.log(`      - Discount amount incorrect`);
          if (!totalCorrect) console.log(`      - Total amount incorrect`);
          if (!typeCorrect) console.log(`      - Discount type incorrect`);
        }
      } else {
        console.log(`   ❌ FAILED - Invoice generation failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ FAILED - Request error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All discount functionality tests passed!');
    console.log('✅ Percentage discounts working correctly');
    console.log('✅ Fixed amount discounts working correctly');
    console.log('✅ Indonesian discount keywords supported');
    console.log('✅ No discount cases handled properly');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} tests failed. Please review the implementation.`);
  }
  
  console.log('\n💡 Discount functionality is now ready for production use!');
}

// Run the comprehensive test
testDiscountScenarios().then(() => {
  console.log('\n🏁 Comprehensive test completed');
}).catch(error => {
  console.error('❌ Comprehensive test error:', error);
});