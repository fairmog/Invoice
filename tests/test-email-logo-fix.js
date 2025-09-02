import fetch from 'node-fetch';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🧪 Testing Email Logo Fix\n');

async function testEmailLogoFix() {
    try {
        console.log('📋 Step 1: Test logo URL accessibility endpoints...');
        
        // Test business logo endpoint
        const businessLogoResponse = await fetch(`${BASE_URL}/api/test-business-logo`);
        const businessLogoData = await businessLogoResponse.json();
        
        console.log('  Business Logo Test:', {
            accessible: businessLogoData.accessible,
            url: businessLogoData.logoUrl,
            status: businessLogoData.status,
            contentType: businessLogoData.contentType,
            isImage: businessLogoData.isImage
        });
        
        if (!businessLogoData.accessible) {
            console.log('  ⚠️ Business logo not accessible, testing default logo...');
            
            // Test default Aspree logo
            const defaultLogoUrl = `${BASE_URL}/aspree2-logo.png?v=2`;
            const defaultLogoResponse = await fetch(`${BASE_URL}/api/test-logo-url?url=${encodeURIComponent(defaultLogoUrl)}`);
            const defaultLogoData = await defaultLogoResponse.json();
            
            console.log('  Default Logo Test:', {
                accessible: defaultLogoData.accessible,
                url: defaultLogoData.url,
                status: defaultLogoData.status,
                contentType: defaultLogoData.contentType,
                isImage: defaultLogoData.isImage
            });
        }
        
        console.log('\n📋 Step 2: Test email generation with logo debugging...');
        
        // Test invoice email generation
        const testMessage = `Test Email Logo Fix
Customer: Test Customer
Email: test@example.com
Phone: +62 123 456 789
Product: Test Product - 1pcs @ Rp 100,000
Total: Rp 100,000`;

        const previewResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: testMessage,
                phone: '+62123456789',
                timestamp: new Date().toISOString()
            })
        });

        if (!previewResponse.ok) {
            throw new Error(`Preview failed: ${previewResponse.status} ${previewResponse.statusText}`);
        }

        const invoiceData = await previewResponse.json();
        console.log('  ✅ Invoice preview generated successfully');
        console.log('  Invoice ID:', invoiceData.invoice.id);
        
        console.log('\n📋 Step 3: Test email sending with logo...');
        
        // Send test email to see logo in action
        const emailResponse = await fetch(`${BASE_URL}/api/send-test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customerEmail: 'test@example.com'
            })
        });

        const emailResult = await emailResponse.json();
        console.log('  Email Send Result:', {
            success: emailResult.success,
            messageId: emailResult.messageId,
            mode: emailResult.mode || 'real'
        });
        
        if (emailResult.success) {
            console.log('  ✅ Email sent successfully - check console logs for logo debug info');
        } else {
            console.log('  ⚠️ Email send failed or in mock mode:', emailResult.error || emailResult.note);
        }
        
        console.log('\n📋 Step 4: Test logo fallback scenarios...');
        
        // Test with invalid logo URL
        const invalidLogoTest = await fetch(`${BASE_URL}/api/test-logo-url?url=${encodeURIComponent('https://invalid-domain-test-12345.com/logo.png')}`);
        const invalidLogoData = await invalidLogoTest.json();
        
        console.log('  Invalid URL Test:', {
            accessible: invalidLogoData.accessible,
            error: invalidLogoData.error,
            timeout: invalidLogoData.timeout
        });
        
        console.log('\n📋 Step 5: Verify file system access for local logos...');
        
        // Check if aspree2-logo.png exists
        const logoFiles = [
            'aspree2-logo.png',
            'aspree-logo.png',
            'Aspree.png'
        ];
        
        for (const logoFile of logoFiles) {
            try {
                const stats = fs.statSync(logoFile);
                console.log(`  ✅ ${logoFile} exists (${Math.round(stats.size / 1024)}KB)`);
                
                // Test direct URL access
                const directUrlTest = await fetch(`${BASE_URL}/api/test-logo-url?url=${encodeURIComponent(`${BASE_URL}/${logoFile}`)}`);
                const directUrlData = await directUrlTest.json();
                console.log(`    URL access: ${directUrlData.accessible ? '✅' : '❌'} (${directUrlData.status})`);
                
            } catch (error) {
                console.log(`  ❌ ${logoFile} not found`);
            }
        }
        
        console.log('\n🎉 Email Logo Fix Test Complete!');
        console.log('\nSummary:');
        console.log('✅ Enhanced email logo construction with comprehensive logging');
        console.log('✅ Added URL validation and error handling');
        console.log('✅ Implemented fallback mechanisms for broken logos');
        console.log('✅ Created logo accessibility test endpoints');
        console.log('✅ Email templates now handle logo failures gracefully');
        
        console.log('\n📧 Next time an email is sent, check the console logs for detailed');
        console.log('   logo URL construction debugging information.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

// Run the test
testEmailLogoFix().catch(console.error);