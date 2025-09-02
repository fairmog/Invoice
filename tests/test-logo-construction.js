import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

console.log('🧪 Email Logo Construction Test\n');

// Test the logo URL construction logic directly
function constructLogoUrl(businessSettings, baseUrl) {
    console.log('📧 ===== EMAIL LOGO CONSTRUCTION DEBUG =====');
    console.log('📧 BASE_URL from env:', process.env.BASE_URL);
    console.log('📧 baseUrl used:', baseUrl);
    console.log('📧 businessSettings:', businessSettings ? {
      name: businessSettings.name,
      logo: businessSettings.logo,
      logoUrl: businessSettings.logoUrl
    } : 'null');
    
    let businessLogo = null;
    const logoPath = businessSettings?.logo;
    console.log('📧 logoPath extracted:', logoPath);
    
    if (logoPath) {
        // If logo is already absolute URL or data URL, use as is
        if (logoPath.startsWith('http') || logoPath.startsWith('data:')) {
            businessLogo = logoPath;
            console.log('📧 ✅ Using absolute/data URL as-is:', businessLogo);
        } else {
            // Convert relative path to absolute URL
            const cleanPath = logoPath.replace(/^\//, '');
            businessLogo = `${baseUrl}/${cleanPath}`;
            console.log('📧 ✅ Converted relative to absolute:', {
                original: logoPath,
                cleaned: cleanPath,
                final: businessLogo
            });
        }
    } else {
        // Default to Aspree logo if no business logo is provided
        businessLogo = `${baseUrl}/aspree2-logo.png?v=2`;
        console.log('📧 ⚠️ Using default Aspree logo (no business logo provided):', businessLogo);
    }
    
    // Validate the constructed URL
    try {
        new URL(businessLogo);
        console.log('📧 ✅ Logo URL is valid:', businessLogo);
    } catch (error) {
        console.error('📧 ❌ Invalid logo URL constructed:', businessLogo, error.message);
        // Fallback to default logo with base URL
        businessLogo = `${baseUrl}/aspree2-logo.png?v=2`;
        console.log('📧 🔧 Fallback to default logo:', businessLogo);
    }
    
    console.log('📧 ===== FINAL LOGO URL =====', businessLogo);
    console.log('📧 ==========================================');
    
    return businessLogo;
}

// Test scenarios
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

console.log('📋 Test Case 1: No business settings (should use default)');
const logoUrl1 = constructLogoUrl(null, baseUrl);
console.log('Result:', logoUrl1, '\n');

console.log('📋 Test Case 2: Relative logo path');
const logoUrl2 = constructLogoUrl({
    name: 'Test Business',
    logo: 'uploads/business-logos/business-logo.png'
}, baseUrl);
console.log('Result:', logoUrl2, '\n');

console.log('📋 Test Case 3: Absolute URL logo');
const logoUrl3 = constructLogoUrl({
    name: 'Test Business',
    logo: 'https://example.com/logo.png'
}, baseUrl);
console.log('Result:', logoUrl3, '\n');

console.log('📋 Test Case 4: Data URL logo');
const logoUrl4 = constructLogoUrl({
    name: 'Test Business',
    logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
}, baseUrl);
console.log('Result:', logoUrl4, '\n');

console.log('📋 Checking available logo files in project...');
const logoFiles = [
    'aspree2-logo.png',
    'aspree-logo.png',
    'Aspree.png',
    'aspri-logo.png'
];

for (const logoFile of logoFiles) {
    try {
        const stats = fs.statSync(logoFile);
        console.log(`✅ ${logoFile} exists (${Math.round(stats.size / 1024)}KB)`);
    } catch (error) {
        console.log(`❌ ${logoFile} not found`);
    }
}

console.log('\n🎉 Logo Construction Test Complete!');
console.log('\n✅ The email logo fixes include:');
console.log('  • Comprehensive debugging and logging');
console.log('  • URL validation and error handling');
console.log('  • Fallback mechanisms for broken logos');
console.log('  • Support for relative, absolute, and data URLs');
console.log('  • Graceful degradation with first letter fallback');
console.log('\n📧 Logo URLs are now constructed reliably for email templates');
console.log('   and will show detailed debugging information when emails are sent.');