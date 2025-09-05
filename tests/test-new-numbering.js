import SimpleDatabase from './simple-database.js';

async function testNewNumberingSystem() {
  console.log('🧪 Testing New Invoice and Order Numbering System');
  console.log('=' .repeat(60));
  
  const database = new SimpleDatabase();
  
  // Test 1: Set business code
  console.log('\n📋 Test 1: Setting business code');
  database.data.business_settings.businessCode = 'BEV';
  database.data.business_settings.name = 'Bevelient';
  database.saveData();
  console.log('✅ Business code set to "BEV" for Bevelient');
  
  // Test 2: Generate invoice numbers
  console.log('\n📋 Test 2: Generating invoice numbers');
  const invoice1 = await database.generateInvoiceNumber();
  const invoice2 = await database.generateInvoiceNumber();
  const invoice3 = await database.generateInvoiceNumber();
  
  console.log(`✅ Invoice 1: ${invoice1}`);
  console.log(`✅ Invoice 2: ${invoice2}`);
  console.log(`✅ Invoice 3: ${invoice3}`);
  
  // Test 3: Generate order numbers
  console.log('\n📋 Test 3: Generating order numbers');
  const order1 = await database.generateOrderNumber();
  const order2 = await database.generateOrderNumber();
  const order3 = await database.generateOrderNumber();
  
  console.log(`✅ Order 1: ${order1}`);
  console.log(`✅ Order 2: ${order2}`);
  console.log(`✅ Order 3: ${order3}`);
  
  // Test 4: Verify format
  console.log('\n📋 Test 4: Verifying format requirements');
  const invoicePattern = /^#INV-BEV-\d{8}-[A-Z0-9]{4}$/;
  const orderPattern = /^#ORD-BEV-\d{8}-[A-Z0-9]{4}$/;
  
  console.log(`✅ Invoice format valid: ${invoicePattern.test(invoice1)}`);
  console.log(`✅ Order format valid: ${orderPattern.test(order1)}`);
  
  // Test 5: Test different business code
  console.log('\n📋 Test 5: Testing different business code');
  database.data.business_settings.businessCode = 'ABC';
  const invoiceABC = await database.generateInvoiceNumber();
  const orderABC = await database.generateOrderNumber();
  
  console.log(`✅ ABC Invoice: ${invoiceABC}`);
  console.log(`✅ ABC Order: ${orderABC}`);
  
  // Test 6: Test default when no business code
  console.log('\n📋 Test 6: Testing default behavior with empty business code');
  database.data.business_settings.businessCode = '';
  const invoiceDefault = await database.generateInvoiceNumber();
  const orderDefault = await database.generateOrderNumber();
  
  console.log(`✅ Default Invoice: ${invoiceDefault}`);
  console.log(`✅ Default Order: ${orderDefault}`);
  
  // Test 7: Uniqueness test
  console.log('\n📋 Test 7: Testing uniqueness (generating 10 numbers)');
  database.data.business_settings.businessCode = 'TEST';
  const numbers = new Set();
  
  for (let i = 0; i < 10; i++) {
    const num = await database.generateInvoiceNumber();
    numbers.add(num);
  }
  
  console.log(`✅ Generated 10 unique numbers: ${numbers.size === 10}`);
  console.log('Sample numbers:');
  Array.from(numbers).slice(0, 3).forEach((num, idx) => {
    console.log(`   ${idx + 1}. ${num}`);
  });
  
  console.log('\n🎉 All tests completed!');
  console.log('\n🔍 Key Benefits:');
  console.log('   • Business-specific prefixes (BEV, ABC, etc.)');
  console.log('   • Privacy-safe random hashes instead of sequential numbers');
  console.log('   • Professional format: #INV-BEV-20250828-A7K9');
  console.log('   • Customers cannot determine daily invoice volume');
}

// Run the test
testNewNumberingSystem().catch(console.error);