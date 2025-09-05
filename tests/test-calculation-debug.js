#!/usr/bin/env node

/**
 * Debug Calculation Issues
 * 
 * This test investigates why all calculations are showing 0
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testCalculationDebug() {
  console.log('🐛 Debugging Calculation Issues');
  console.log('=' .repeat(50));

  try {
    // Test with a normal paid item that should have proper calculations
    const testMessage = `laptop gaming 1pc harga 15000000
Customer: John Doe
Phone: 08123456789
Address: Jakarta Selatan`;

    const businessProfile = {
      name: "Test Electronics Store",
      email: "test@store.com", 
      phone: "08111222333",
      address: "Test Store Address"
    };

    console.log('📝 Testing normal paid item calculations...');
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
      return;
    }
    
    console.log('✅ Preview succeeded');
    
    const invoice = previewData.invoice;
    
    console.log('\n📊 CALCULATION ANALYSIS:');
    console.log('=' .repeat(50));
    
    // Check individual items
    console.log('\n📋 ITEMS:');
    invoice.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.productName}:`);
      console.log(`   - Quantity: ${item.quantity}`);
      console.log(`   - Unit Price: ${item.unitPrice}`);
      console.log(`   - Line Total: ${item.lineTotal}`);
      console.log(`   - Tax Rate: ${item.taxRate}%`);
      console.log(`   - Tax Amount: ${item.taxAmount}`);
    });
    
    // Check calculations object
    console.log('\n💰 CALCULATIONS:');
    const calc = invoice.calculations;
    console.log(`- Subtotal: ${calc.subtotal}`);
    console.log(`- Total Tax: ${calc.totalTax}`);
    console.log(`- Discount: ${calc.discount}`);
    console.log(`- Shipping Cost: ${calc.shippingCost}`);
    console.log(`- Grand Total: ${calc.grandTotal}`);
    
    // Check payment schedule if exists
    if (invoice.paymentSchedule) {
      console.log('\n💳 PAYMENT SCHEDULE:');
      console.log(`- Down Payment: ${invoice.paymentSchedule.downPayment}`);
      console.log(`- Remaining: ${invoice.paymentSchedule.remaining}`);
    }

    // Identify the issue
    console.log('\n🔍 ISSUE ANALYSIS:');
    if (calc.subtotal === 0 && invoice.items.length > 0 && invoice.items[0].unitPrice > 0) {
      console.log('❌ PROBLEM: Subtotal is 0 despite having paid items');
      console.log('💡 LIKELY CAUSE: Issue in subtotal calculation logic');
    } else if (calc.subtotal > 0 && calc.grandTotal === 0) {
      console.log('❌ PROBLEM: Grand total is 0 despite positive subtotal');
      console.log('💡 LIKELY CAUSE: Issue in grand total calculation logic');
    } else if (invoice.items[0].lineTotal === 0 && invoice.items[0].unitPrice > 0) {
      console.log('❌ PROBLEM: Line total is 0 despite positive unit price');
      console.log('💡 LIKELY CAUSE: Issue in line total calculation');
    } else {
      console.log('✅ Calculations appear correct');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testCalculationDebug().catch(console.error);