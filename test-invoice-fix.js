#!/usr/bin/env node

/**
 * Test script to verify invoice summary fix
 * Tests that invoice print view shows subtotal, discount, pajak, and biaya kirim
 */

import SimpleDatabase from './src/simple-database.js';

async function testInvoiceFix() {
  console.log('🧪 Testing Invoice Summary Fix');
  console.log('='.repeat(50));
  
  const db = new SimpleDatabase();
  const invoices = db.data.invoices;
  
  // Find a recent invoice with discount
  const testInvoice = invoices.find(inv => 
    inv.discount && inv.discount > 0 && inv.subtotal > 0
  );
  
  if (!testInvoice) {
    console.log('❌ No test invoice found with discount');
    return;
  }
  
  console.log('📋 Testing with invoice:', testInvoice.invoice_number);
  console.log('   Customer:', testInvoice.customer_name);
  console.log('   Subtotal:', testInvoice.subtotal);
  console.log('   Discount:', testInvoice.discount);
  console.log('   Tax:', testInvoice.tax_amount);
  console.log('   Shipping:', testInvoice.shipping_cost);
  console.log('   Grand Total:', testInvoice.grand_total);
  console.log('');
  
  console.log('🔗 Test URLs:');
  console.log(`   Direct view: http://localhost:3000/invoice?id=${testInvoice.id}`);
  console.log(`   Print view:  http://localhost:3000/invoice?id=${testInvoice.id}&print=true`);
  console.log(`   Dashboard:   http://localhost:3000/merchant-dashboard`);
  console.log('');
  
  console.log('✅ Expected behavior after fix:');
  console.log('   - Subtotal line: ✅ Always visible');
  console.log('   - Discount line: ✅ Visible when discount exists');
  console.log('   - Pajak line: ✅ Always visible (even if Rp 0)');
  console.log('   - Biaya Kirim line: ✅ Always visible (even if Rp 0)');
  console.log('   - Total line: ✅ Always visible');
  console.log('');
  
  // Test multiple recent invoices
  console.log('📊 Recent invoices for testing:');
  const recentInvoices = invoices.slice(-5);
  recentInvoices.forEach((inv, index) => {
    console.log(`   [${index+1}] ${inv.invoice_number} - ${inv.customer_name}`);
    console.log(`       http://localhost:3000/invoice?id=${inv.id}&print=true`);
  });
  
  console.log('');
  console.log('🖨️ To test print view:');
  console.log('   1. Open any URL above');
  console.log('   2. Check that invoice summary shows:');
  console.log('      - Subtotal');
  console.log('      - Diskon (if applicable)');
  console.log('      - Pajak');
  console.log('      - Biaya Kirim');
  console.log('      - TOTAL');
  console.log('   3. Use Ctrl+P to test print view');
  console.log('');
  
  return testInvoice;
}

testInvoiceFix().catch(console.error);