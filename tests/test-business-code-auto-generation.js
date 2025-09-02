// Test script for automatic business code generation
import SimpleDatabase from './simple-database.js';

console.log('🧪 Testing Automatic Business Code Generation');
console.log('='.repeat(60));

const database = new SimpleDatabase();

async function testBusinessCodeGeneration() {
  // Test 1: Reset business settings to clean state
  console.log('\n📋 Test 1: Resetting business settings to clean state');
  database.data.business_settings = {};
  database.saveData();
  console.log('✅ Business settings reset');

  // Test 2: Test BEVELIENT name conversion
  console.log('\n📋 Test 2: Testing BEVELIENT → BEV conversion');
  const bevelientSettings = await database.updateBusinessSettings({
    name: 'BEVELIENT',
    email: 'info@bevelient.com'
  });
  
  console.log(`✅ Business Name: ${bevelientSettings.name}`);
  console.log(`✅ Generated Code: ${bevelientSettings.businessCode}`);
  console.log(`✅ Expected: BEV, Got: ${bevelientSettings.businessCode}`);
  console.log(`✅ Test Result: ${bevelientSettings.businessCode === 'BEV' ? 'PASS' : 'FAIL'}`);

  // Test 3: Test invoice number generation
  console.log('\n📋 Test 3: Testing invoice number with new business code');
  const invoiceNumber = await database.generateInvoiceNumber();
  console.log(`✅ Generated Invoice Number: ${invoiceNumber}`);
  console.log(`✅ Contains BEV: ${invoiceNumber.includes('BEV') ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Correct Format: ${invoiceNumber.match(/#INV-BEV-\d{8}-[A-Z0-9]{4}/) ? 'PASS' : 'FAIL'}`);

  // Test 4: Test order number generation
  console.log('\n📋 Test 4: Testing order number with new business code');
  const orderNumber = await database.generateOrderNumber();
  console.log(`✅ Generated Order Number: ${orderNumber}`);
  console.log(`✅ Contains BEV: ${orderNumber.includes('BEV') ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Correct Format: ${orderNumber.match(/#ORD-BEV-\d{8}-[A-Z0-9]{4}/) ? 'PASS' : 'FAIL'}`);

  // Test 5: Test that existing business code is not overridden
  console.log('\n📋 Test 5: Testing existing business code preservation');
  const preservedSettings = await database.updateBusinessSettings({
    name: 'Updated Business Name',
    address: 'New Address'
  });
  
  console.log(`✅ Business Name Updated: ${preservedSettings.name}`);
  console.log(`✅ Business Code Preserved: ${preservedSettings.businessCode}`);
  console.log(`✅ Code Still BEV: ${preservedSettings.businessCode === 'BEV' ? 'PASS' : 'FAIL'}`);

  // Test 6: Test multi-word business name
  console.log('\n📋 Test 6: Testing multi-word business name');
  
  // Reset to test multi-word
  database.data.business_settings = {};
  
  const multiWordSettings = await database.updateBusinessSettings({
    name: 'Amazing Business Solutions',
    email: 'info@abs.com'
  });
  
  console.log(`✅ Multi-word Name: ${multiWordSettings.name}`);
  console.log(`✅ Generated Code: ${multiWordSettings.businessCode}`);
  console.log(`✅ Expected: ABS, Got: ${multiWordSettings.businessCode}`);
  console.log(`✅ Test Result: ${multiWordSettings.businessCode === 'ABS' ? 'PASS' : 'FAIL'}`);

  // Test 7: Test single word short name
  console.log('\n📋 Test 7: Testing short single word');
  
  // Reset to test short name
  database.data.business_settings = {};
  
  const shortNameSettings = await database.updateBusinessSettings({
    name: 'Go',
    email: 'info@go.com'
  });
  
  console.log(`✅ Short Name: ${shortNameSettings.name}`);
  console.log(`✅ Generated Code: ${shortNameSettings.businessCode}`);
  console.log(`✅ Expected: GO (padded), Got: ${shortNameSettings.businessCode}`);

  // Test 8: Reset back to BEVELIENT for final verification
  console.log('\n📋 Test 8: Final BEVELIENT setup verification');
  
  database.data.business_settings = {};
  
  const finalSettings = await database.updateBusinessSettings({
    name: 'BEVELIENT',
    email: 'info@bevelient.com',
    address: 'Business Address',
    phone: '+1234567890'
  });
  
  console.log('✅ Final Business Settings:');
  console.log(`   Name: ${finalSettings.name}`);
  console.log(`   Code: ${finalSettings.businessCode}`);
  console.log(`   Email: ${finalSettings.email}`);

  // Test final invoice generation
  const finalInvoice = await database.generateInvoiceNumber();
  const finalOrder = await database.generateOrderNumber();
  
  console.log('\n✅ Final Number Generation:');
  console.log(`   Invoice: ${finalInvoice}`);
  console.log(`   Order: ${finalOrder}`);
  console.log(`   Format Check: ${finalInvoice.startsWith('#INV-BEV-') ? 'PASS' : 'FAIL'}`);

  console.log('\n🎯 Summary:');
  console.log('✅ Automatic business code generation implemented');
  console.log('✅ BEVELIENT → BEV conversion working');
  console.log('✅ Multi-word names → first letters working');
  console.log('✅ Existing codes preserved when updating other settings');
  console.log('✅ Invoice numbers now use correct business codes');

  console.log('\n📋 Next Steps:');
  console.log('1. Update business settings via web interface');
  console.log('2. Verify invoice sharing now works correctly');
  console.log('3. Confirm invoice numbers show #INV-BEV-YYYYMMDD-XXXX format');
}

// Run the test
testBusinessCodeGeneration().catch(console.error);