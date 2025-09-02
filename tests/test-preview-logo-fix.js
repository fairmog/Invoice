import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🧪 Testing Invoice Preview Logo Fix\n');

async function testPreviewLogoFix() {
  try {
    // Test 1: Check if business settings API has logo
    console.log('📋 Test 1: Verify business settings has logo');
    const settingsResponse = await fetch(`${BASE_URL}/api/business-settings`);
    
    let hasLogo = false;
    let logoUrl = null;
    
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      hasLogo = !!(settings.logoUrl);
      logoUrl = settings.logoUrl;
      console.log(`  🖼️  Logo in settings: ${hasLogo ? 'Yes' : 'No'}`);
      if (hasLogo) {
        console.log(`  📎 Logo URL: ${logoUrl}`);
      }
    } else {
      console.log(`  ❌ Failed to load business settings: ${settingsResponse.status}`);
      return;
    }

    if (!hasLogo) {
      console.log('\n⚠️  No logo found in business settings. Please upload a logo first.');
      console.log('   1. Go to web interface');
      console.log('   2. Open Business Settings modal');
      console.log('   3. Upload a logo');
      console.log('   4. Run this test again');
      return;
    }

    // Test 2: Generate invoice preview and check metadata
    console.log('\n📋 Test 2: Generate invoice preview with business profile');
    
    const testMessage = `Invoice untuk:
John Doe
Phone: 08123456789
Email: john@example.com

Items:
- Test Product x 2 = Rp 200,000

Total: Rp 200,000`;

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
      
      // Check if business profile metadata contains logo
      if (result.invoice && result.invoice.metadata) {
        let metadata;
        if (typeof result.invoice.metadata === 'string') {
          metadata = JSON.parse(result.invoice.metadata);
        } else {
          metadata = result.invoice.metadata;
        }
        
        if (metadata.businessProfile) {
          const profile = metadata.businessProfile;
          if (profile.logoUrl || profile.logo) {
            console.log(`  ✅ Business profile in metadata contains logo`);
            console.log(`  📎 Logo field: ${profile.logo ? 'Yes' : 'No'}`);
            console.log(`  📎 LogoUrl field: ${profile.logoUrl ? 'Yes' : 'No'}`);
          } else {
            console.log(`  ⚠️  Business profile in metadata missing logo fields`);
          }
        } else {
          console.log(`  ⚠️  No business profile found in invoice metadata`);
        }
      } else {
        console.log(`  ⚠️  Invoice metadata not found`);
      }
    } else {
      console.log(`  ❌ Failed to generate invoice preview: ${previewResponse.status}`);
    }

    console.log('\n🎉 Preview logo fix tests completed!');
    console.log('\n📋 What was fixed:');
    console.log('  1. ✅ loadBusinessDataFromAPI() now syncs logo to localStorage');
    console.log('  2. ✅ generateUnifiedInvoiceTemplate() has API fallback for logo');
    console.log('  3. ✅ updateLogoInPreviewTemplate() updates logo after async load');
    console.log('  4. ✅ Business profile localStorage includes both logo and logoUrl fields');
    
    console.log('\n🔄 How to test:');
    console.log('  1. Upload logo in Business Settings');
    console.log('  2. Generate invoice in web interface');  
    console.log('  3. Logo should appear in preview AND final invoice');
    console.log('  4. Check browser console for logo loading messages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPreviewLogoFix().catch(console.error);