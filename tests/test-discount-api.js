// Test discount functionality through the API
console.log('🧪 Testing Discount Functionality via API');
console.log('='.repeat(60));

async function testDiscountAPI() {
  try {
    // Test message with percentage discount
    const testMessageWithPercentageDiscount = `
lolly 2pcs harga 50000 each discount 10%
John Doe - 081234567890
Jl. Merdeka No 123 Jakarta
    `.trim();

    console.log('🔍 Testing message with 10% discount:');
    console.log(`Input: "${testMessageWithPercentageDiscount}"`);

    const response1 = await fetch('http://localhost:3000/api/process-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessageWithPercentageDiscount,
        businessProfile: {
          businessName: 'Test Business',
          address: 'Test Address',
          phone: '021-1234567',
          email: 'test@business.com',
          taxEnabled: false
        }
      })
    });

    if (!response1.ok) {
      console.error('❌ API request failed:', response1.status, response1.statusText);
      return;
    }

    const result1 = await response1.json();
    console.log('\n📊 API Response (Percentage Discount):');
    
    if (result1.success && result1.invoice) {
      const calculations = result1.invoice.calculations;
      console.log(`✅ Invoice generated successfully`);
      console.log(`Subtotal: ${calculations.subtotal}`);
      console.log(`Discount: ${calculations.discount} (Type: ${calculations.discountType || 'unknown'})`);
      console.log(`Grand Total: ${calculations.grandTotal}`);
      
      // Expected: 10% of 100000 = 10000 discount
      const expectedDiscount = 100000 * 0.10;
      const expectedTotal = 100000 - expectedDiscount; // Assuming no shipping/tax
      
      console.log(`Expected Discount: ${expectedDiscount}`);
      console.log(`Expected Total: ${expectedTotal}`);
      
      const discountCorrect = Math.abs(calculations.discount - expectedDiscount) < 100; // Allow small variance
      console.log(`Discount Calculation: ${discountCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    } else {
      console.error('❌ Failed to generate invoice:', result1.error || 'Unknown error');
      console.log('Response:', JSON.stringify(result1, null, 2));
    }

    console.log('\n' + '='.repeat(60));

    // Test message with fixed discount
    const testMessageWithFixedDiscount = `
produk 1pc harga 200000 diskon 25000
Jane Smith - 081987654321
Jl. Sudirman No 456 Jakarta
    `.trim();

    console.log('🔍 Testing message with fixed 25000 discount:');
    console.log(`Input: "${testMessageWithFixedDiscount}"`);

    const response2 = await fetch('http://localhost:3000/api/process-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessageWithFixedDiscount,
        businessProfile: {
          businessName: 'Test Business',
          address: 'Test Address',
          phone: '021-1234567',
          email: 'test@business.com',
          taxEnabled: false
        }
      })
    });

    if (!response2.ok) {
      console.error('❌ API request failed:', response2.status, response2.statusText);
      return;
    }

    const result2 = await response2.json();
    console.log('\n📊 API Response (Fixed Discount):');
    
    if (result2.success && result2.invoice) {
      const calculations = result2.invoice.calculations;
      console.log(`✅ Invoice generated successfully`);
      console.log(`Subtotal: ${calculations.subtotal}`);
      console.log(`Discount: ${calculations.discount} (Type: ${calculations.discountType || 'unknown'})`);
      console.log(`Grand Total: ${calculations.grandTotal}`);
      
      const expectedDiscount = 25000;
      const expectedTotal = 200000 - expectedDiscount; // Assuming no shipping/tax
      
      console.log(`Expected Discount: ${expectedDiscount}`);
      console.log(`Expected Total: ${expectedTotal}`);
      
      const discountCorrect = Math.abs(calculations.discount - expectedDiscount) < 100; // Allow small variance
      console.log(`Discount Calculation: ${discountCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    } else {
      console.error('❌ Failed to generate invoice:', result2.error || 'Unknown error');
      console.log('Response:', JSON.stringify(result2, null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDiscountAPI().then(() => {
  console.log('\n🏁 Test completed');
}).catch(error => {
  console.error('❌ Test error:', error);
});