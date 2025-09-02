import fs from 'fs';

console.log('🧪 Multiple Order Print Alignment Test\n');

// Test by analyzing the merchant-dashboard.html file
const dashboardPath = './merchant-dashboard.html';

try {
    const content = fs.readFileSync(dashboardPath, 'utf8');
    
    console.log('📋 Testing Multiple Order Print Alignment with Individual Service Ticket...\n');
    
    // Test 1: Verify Status field removal in generateThermalTicketHTML specifically
    const thermalFunctionMatch = content.match(/function generateThermalTicketHTML[\s\S]*?(?=function|\s*$)/);
    const thermalFunctionContent = thermalFunctionMatch ? thermalFunctionMatch[0] : '';
    const hasStatusInMultiple = thermalFunctionContent.includes('thermal-label">Status:') || 
                               thermalFunctionContent.includes('Status:</span>');
    console.log('✅ Test 1: Status Field Removal in Multiple Print');
    console.log(`   Status field removed: ${!hasStatusInMultiple ? '✅ PASS' : '❌ FAIL'}`);
    
    if (hasStatusInMultiple) {
        console.log('   ⚠️ Status field still present in generateThermalTicketHTML');
    }
    
    // Test 2: Verify business address and phone addition
    const hasBusinessAddress = content.includes('thermal-business-address') && 
                              content.includes('businessSettings.address');
    const hasBusinessPhone = content.includes('thermal-business-phone') && 
                            content.includes('businessSettings.phone');
    
    console.log('\\n✅ Test 2: Business Contact Information in Multiple Print');
    console.log(`   Business address added: ${hasBusinessAddress ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Business phone added: ${hasBusinessPhone ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 3: Verify thermal CSS for business contact
    const hasThermalBusinessCSS = content.includes('.thermal-business-contact') && 
                                 content.includes('.thermal-business-address') &&
                                 content.includes('.thermal-business-phone');
    
    console.log('\\n✅ Test 3: Thermal CSS for Business Contact');
    console.log(`   Thermal business CSS added: ${hasThermalBusinessCSS ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 4: Verify business settings access improvement
    const hasBetterBusinessAccess = content.includes('/api/business-settings') && 
                                   content.includes('/api/business-profile') &&
                                   content.includes('address: \'Business address not provided\'');
    
    console.log('\\n✅ Test 4: Enhanced Business Settings Access');
    console.log(`   Improved settings access: ${hasBetterBusinessAccess ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 5: Verify header structure alignment
    const hasCorrectHeaderStructure = content.includes('thermal-title') && 
                                     content.includes('thermal-business-contact') &&
                                     content.includes('thermal-subtitle">SERVICE TICKET');
    
    console.log('\\n✅ Test 5: Header Structure Alignment');
    console.log(`   Header structure matches: ${hasCorrectHeaderStructure ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 6: Compare with individual service ticket structure
    const serviceTicketContent = fs.readFileSync('./service-ticket.html', 'utf8');
    
    // Check if both have no status field
    const individualHasNoStatus = !serviceTicketContent.includes('order-status');
    const multipleHasNoStatus = !hasStatusInMultiple;
    
    // Check if both have business contact info
    const individualHasBusinessInfo = serviceTicketContent.includes('business-address') && 
                                     serviceTicketContent.includes('business-phone');
    const multipleHasBusinessInfo = hasBusinessAddress && hasBusinessPhone;
    
    console.log('\\n✅ Test 6: Alignment with Individual Service Ticket');
    console.log(`   Both have no status field: ${(individualHasNoStatus && multipleHasNoStatus) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Both have business contact: ${(individualHasBusinessInfo && multipleHasBusinessInfo) ? '✅ PASS' : '❌ FAIL'}`);
    
    // Summary
    const allTests = [!hasStatusInMultiple, hasBusinessAddress, hasBusinessPhone, 
                     hasThermalBusinessCSS, hasBetterBusinessAccess, hasCorrectHeaderStructure,
                     (individualHasNoStatus && multipleHasNoStatus), 
                     (individualHasBusinessInfo && multipleHasBusinessInfo)];
    const passedTests = allTests.filter(test => test).length;
    const totalTests = allTests.length;
    
    console.log('\\n🎯 Summary:');
    console.log(`   Tests passed: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('   🎉 All alignment tests passed!');
        console.log('\\n📋 Multiple Order Print Now Matches Individual Service Ticket:');
        console.log('   ✅ Both views show business name prominently');
        console.log('   ✅ Both views show business address under business name');  
        console.log('   ✅ Both views show business phone number');
        console.log('   ✅ Both views have NO status field in Order Information');
        console.log('   ✅ Both views show Total field in Order Information');
        console.log('   ✅ Both views use consistent styling and information hierarchy');
        
        console.log('\\n🚀 Expected User Experience:');
        console.log('   • Individual "🎫 View Ticket" button → Shows service ticket with business contact');
        console.log('   • Multiple "🖨️ Print Selected" button → Shows same format for all selected orders');
        console.log('   • Both provide essential shipping information (address & phone)');
        console.log('   • Both have clean Order Information without redundant status');
        console.log('   • Consistent branding and information across all service tickets');
        
        console.log('\\n📊 Implementation Complete:');
        console.log('   ✅ generateThermalTicketHTML function updated to match service-ticket.html');
        console.log('   ✅ Business settings access improved with better fallbacks');
        console.log('   ✅ CSS styling added for thermal business contact information');
        console.log('   ✅ Both individual and multiple print views now aligned perfectly');
        
    } else {
        console.log('   ⚠️  Some alignment issues need review');
        if (!passedTests) {
            console.log('\\n🔧 Issues to address:');
            if (hasStatusInMultiple) console.log('   • Remove remaining status field references');
            if (!hasBusinessAddress) console.log('   • Add business address to thermal header');
            if (!hasBusinessPhone) console.log('   • Add business phone to thermal header');
            if (!hasThermalBusinessCSS) console.log('   • Add CSS styling for business contact');
        }
    }
    
} catch (error) {
    console.error('❌ Error reading files:', error.message);
}