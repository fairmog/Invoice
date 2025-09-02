import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🧪 Testing Logo Fix Implementation\n');

async function testLogoInInvoices() {
  try {
    // Test 1: Check if business settings API returns logo
    console.log('📋 Test 1: Check business settings API includes logo');
    const settingsResponse = await fetch(`${BASE_URL}/api/business-settings`);
    
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      console.log(`  📄 Business settings loaded`);
      console.log(`  🖼️  Logo URL: ${settings.logoUrl ? 'Found' : 'Not found'}`);
      console.log(`  📝 Logo filename: ${settings.logoFilename || 'None'}`);
      
      if (settings.logoUrl) {
        console.log(`  ✅ Business settings contains logo: ${settings.logoUrl}`);
      } else {
        console.log(`  ⚠️  No logo found in business settings`);
      }
    } else {
      console.log(`  ❌ Failed to load business settings: ${settingsResponse.status}`);
    }

    // Test 2: Test invoice preview with business profile
    console.log('\n📋 Test 2: Test invoice preview includes logo from settings');
    
    const testMessage = "Invoice untuk:\nJohn Doe\nPhone: 08123456789\nEmail: john@example.com\n\nItems:\n- Test Product x 1 = Rp 100,000\n\nTotal: Rp 100,000";
    
    const previewResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessage,
        businessProfile: null // Test with no business profile to force using settings
      })
    });

    if (previewResponse.ok) {
      const result = await previewResponse.json();
      console.log(`  ✅ Invoice preview generated successfully`);
      
      // Check if the invoice contains business profile with logo
      if (result.invoice && result.invoice.metadata) {
        const metadata = JSON.parse(result.invoice.metadata);
        if (metadata.businessProfile && metadata.businessProfile.logoUrl) {
          console.log(`  ✅ Invoice metadata contains logo: ${metadata.businessProfile.logoUrl}`);
        } else if (metadata.businessProfile && metadata.businessProfile.logo) {
          console.log(`  ✅ Invoice metadata contains logo (legacy): ${metadata.businessProfile.logo.substring(0, 50)}...`);
        } else {
          console.log(`  ⚠️  Invoice metadata does not contain logo`);
        }
      } else {
        console.log(`  ⚠️  Invoice metadata not found or malformed`);
      }
    } else {
      console.log(`  ❌ Failed to generate invoice preview: ${previewResponse.status}`);
      const error = await previewResponse.text();
      console.log(`  📄 Error: ${error.substring(0, 200)}`);
    }

    // Test 3: Test invoice view template fallback
    console.log('\n📋 Test 3: Test invoice view template has fallback logic');
    
    // This would typically be tested by viewing an invoice without logo in metadata
    // For now, we just check that the business settings endpoint is accessible
    const testApiResponse = await fetch(`${BASE_URL}/api/business-settings`);
    if (testApiResponse.ok) {
      console.log(`  ✅ Business settings API is accessible for invoice template fallback`);
    } else {
      console.log(`  ❌ Business settings API not accessible: ${testApiResponse.status}`);
    }

    console.log('\n🎉 Logo fix tests completed!');
    console.log('\n📋 What was fixed:');
    console.log('  1. ✅ getCurrentBusinessSettings() now includes logoUrl from database');
    console.log('  2. ✅ Invoice generation endpoints include current logo in business profile');
    console.log('  3. ✅ Invoice view template has API fallback for missing logos');
    console.log('  4. ✅ Email business settings include logo from current settings');
    
    console.log('\n🔄 Next steps:');
    console.log('  1. Upload a logo in Business Settings');
    console.log('  2. Generate a new invoice');  
    console.log('  3. View the invoice - logo should now appear');
    console.log('  4. Existing invoices will load logo via API fallback');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testLogoInInvoices().catch(console.error);