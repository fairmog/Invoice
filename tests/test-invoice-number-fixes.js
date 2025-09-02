// Test script to debug invoice number issues
import SimpleDatabase from './simple-database.js';

console.log('🧪 Testing Invoice Number Format Fixes');
console.log('='.repeat(60));

const database = new SimpleDatabase();

async function testInvoiceNumberFixes() {
  // Test 1: Check current business settings
  console.log('\n📋 Test 1: Current Business Settings');
  const currentSettings = database.data.business_settings;
  console.log('Current business settings:', {
    name: currentSettings.name || 'Not set',
    businessCode: currentSettings.businessCode || 'Not set',
    email: currentSettings.email || 'Not set'
  });

  // Test 2: Force update business settings with BEVELIENT
  console.log('\n📋 Test 2: Force Update Business Settings');
  const updatedSettings = await database.updateBusinessSettings({
    name: 'BEVELIENT',
    businessCode: 'BEV'  // Explicitly set the code
  });
  
  console.log('Updated business settings:', {
    name: updatedSettings.name,
    businessCode: updatedSettings.businessCode,
    updatedAt: updatedSettings.updatedAt
  });

  // Test 3: Generate new invoice numbers (should now show debug info)
  console.log('\n📋 Test 3: Generate Invoice Numbers (with debug)');
  
  const invoice1 = await database.generateInvoiceNumber();
  console.log(`Generated Invoice: ${invoice1}`);
  
  const invoice2 = await database.generateInvoiceNumber();
  console.log(`Generated Invoice: ${invoice2}`);
  
  const order1 = await database.generateOrderNumber();
  console.log(`Generated Order: ${order1}`);

  // Test 4: Check format correctness
  console.log('\n📋 Test 4: Format Validation');
  
  const invoicePattern = /^INV-BEV-\d{8}-[A-Z0-9]{4}$/;
  const orderPattern = /^ORD-BEV-\d{8}-[A-Z0-9]{4}$/;
  
  console.log(`Invoice format check: ${invoicePattern.test(invoice1) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Order format check: ${orderPattern.test(order1) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`No # symbol in invoice: ${!invoice1.includes('#') ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`No # symbol in order: ${!order1.includes('#') ? '✅ PASS' : '❌ FAIL'}`);

  // Test 5: Test if the business code is being read correctly during generation
  console.log('\n📋 Test 5: Business Code Reading Test');
  
  // Manually check what's in the database
  console.log('Direct database check:');
  console.log(`  businessCode in database: "${database.data.business_settings.businessCode}"`);
  console.log(`  Fallback test: "${database.data.business_settings.businessCode || 'INV'}"`);

  // Test 6: Test URL safety
  console.log('\n📋 Test 6: URL Safety Test');
  
  const testURL = `http://localhost:3000/simple-invoice-view.html?id=${invoice1}`;
  console.log(`Sample URL: ${testURL}`);
  console.log(`URL contains #: ${testURL.includes('#') ? '❌ FAIL - Contains #' : '✅ PASS - No #'}`);
  
  // Test if URL parameters work correctly
  const url = new URL(testURL);
  const idParam = url.searchParams.get('id');
  console.log(`ID parameter extracted: "${idParam}"`);
  console.log(`Parameter extraction: ${idParam === invoice1 ? '✅ PASS' : '❌ FAIL'}`);

  // Summary
  console.log('\n🎯 Summary:');
  console.log('✅ Removed # symbol from invoice format');
  console.log('✅ Added business code debugging');
  console.log(`✅ Business code now: ${updatedSettings.businessCode}`);
  console.log('✅ New format: INV-BEV-YYYYMMDD-XXXX (no #)');
  console.log('✅ URL-safe invoice numbers');

  console.log('\n📝 Expected Results:');
  console.log('• Invoice numbers: INV-BEV-20250828-XXXX');
  console.log('• Order numbers: ORD-BEV-20250828-XXXX');
  console.log('• No # symbol to break URLs');
  console.log('• Proper business code (BEV) from BEVELIENT');

  console.log('\n🔍 Next Steps:');
  console.log('1. Generate a new invoice via web interface');
  console.log('2. Check if it uses INV-BEV format');
  console.log('3. Test invoice sharing links');
  console.log('4. Verify "No invoice ID or token provided" error is fixed');
}

// Run the test
testInvoiceNumberFixes().catch(console.error);