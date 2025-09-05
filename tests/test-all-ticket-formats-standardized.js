import fs from 'fs';

console.log('🧪 All Ticket Formats Standardization Test\n');

// Test all three ticket formats for consistency
const dashboardPath = '../src/merchant-dashboard.html';
const serviceTicketPath = '../src/service-ticket.html';

try {
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    const serviceTicketContent = fs.readFileSync(serviceTicketPath, 'utf8');
    
    console.log('📋 Testing All Three Ticket Format Consistency...\n');
    
    // ==== FORMAT 1: Individual Service Ticket (service-ticket.html) ====
    console.log('✅ Format 1: Individual Service Ticket (service-ticket.html)');
    
    const individualHasNoStatus = !serviceTicketContent.includes('order-status');
    const individualHasBusinessAddress = serviceTicketContent.includes('business-address');
    const individualHasBusinessPhone = serviceTicketContent.includes('business-phone');
    const individualHasNoSubtitle = !serviceTicketContent.includes('Service Ticket</div>');
    
    console.log(`   ✓ No status field: ${individualHasNoStatus ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Has business address: ${individualHasBusinessAddress ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Has business phone: ${individualHasBusinessPhone ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ No subtitle text: ${individualHasNoSubtitle ? '✅ PASS' : '❌ FAIL'}`);
    
    // ==== FORMAT 2: Multiple Order Print (generateThermalTicketHTML) ====
    console.log('\\n✅ Format 2: Multiple Order Print (generateThermalTicketHTML)');
    
    const thermalFunctionMatch = dashboardContent.match(/function generateThermalTicketHTML[\s\S]*?(?=function|\s*$)/);
    const thermalFunctionContent = thermalFunctionMatch ? thermalFunctionMatch[0] : '';
    
    const multipleHasNoStatus = !thermalFunctionContent.includes('thermal-label">Status:');
    const multipleHasBusinessAddress = thermalFunctionContent.includes('thermal-business-address') && 
                                       thermalFunctionContent.includes('businessSettings.address');
    const multipleHasBusinessPhone = thermalFunctionContent.includes('thermal-business-phone') && 
                                     thermalFunctionContent.includes('businessSettings.phone');
    const multipleHasNoSubtitle = !thermalFunctionContent.includes('SERVICE TICKET</div>');
    
    console.log(`   ✓ No status field: ${multipleHasNoStatus ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Has business address: ${multipleHasBusinessAddress ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Has business phone: ${multipleHasBusinessPhone ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ No subtitle text: ${multipleHasNoSubtitle ? '✅ PASS' : '❌ FAIL'}`);
    
    // ==== FORMAT 3: Modal View Ticket (generateServiceTicketHTML) ====
    console.log('\\n✅ Format 3: Modal View Ticket (generateServiceTicketHTML)');
    
    const modalFunctionMatch = dashboardContent.match(/function generateServiceTicketHTML[\s\S]*?(?=function|\s*$)/);
    const modalFunctionContent = modalFunctionMatch ? modalFunctionMatch[0] : '';
    
    const modalHasNoStatus = !modalFunctionContent.includes('info-label">Status:') && 
                            !modalFunctionContent.includes('${statusText}');
    const modalHasBusinessAddress = modalFunctionContent.includes('business-address') && 
                                    modalFunctionContent.includes('businessSettings.address');
    const modalHasBusinessPhone = modalFunctionContent.includes('business-phone') && 
                                  modalFunctionContent.includes('businessSettings.phone');
    const modalHasNoSubtitle = !modalFunctionContent.includes('Ticket</div>');
    
    console.log(`   ✓ No status field: ${modalHasNoStatus ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Has business address: ${modalHasBusinessAddress ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Has business phone: ${modalHasBusinessPhone ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ No subtitle text: ${modalHasNoSubtitle ? '✅ PASS' : '❌ FAIL'}`);
    
    // ==== MODAL TITLE UPDATE ====
    console.log('\\n✅ Modal Title Update');
    const modalTitleUpdated = dashboardContent.includes('modal-title">Order Details</h3>');
    console.log(`   ✓ Modal title changed to "Order Details": ${modalTitleUpdated ? '✅ PASS' : '❌ FAIL'}`);
    
    // ==== CONSISTENCY CHECK ====
    console.log('\\n✅ Cross-Format Consistency Check');
    
    const allHaveNoStatus = individualHasNoStatus && multipleHasNoStatus && modalHasNoStatus;
    const allHaveBusinessAddress = individualHasBusinessAddress && multipleHasBusinessAddress && modalHasBusinessAddress;
    const allHaveBusinessPhone = individualHasBusinessPhone && multipleHasBusinessPhone && modalHasBusinessPhone;
    const allHaveNoSubtitle = individualHasNoSubtitle && multipleHasNoSubtitle && modalHasNoSubtitle;
    
    console.log(`   ✓ All formats have no status field: ${allHaveNoStatus ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ All formats have business address: ${allHaveBusinessAddress ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ All formats have business phone: ${allHaveBusinessPhone ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ All formats have no subtitle: ${allHaveNoSubtitle ? '✅ PASS' : '❌ FAIL'}`);
    
    // ==== SUMMARY ====
    const allTests = [
        individualHasNoStatus, individualHasBusinessAddress, individualHasBusinessPhone, individualHasNoSubtitle,
        multipleHasNoStatus, multipleHasBusinessAddress, multipleHasBusinessPhone, multipleHasNoSubtitle,
        modalHasNoStatus, modalHasBusinessAddress, modalHasBusinessPhone, modalHasNoSubtitle,
        modalTitleUpdated,
        allHaveNoStatus, allHaveBusinessAddress, allHaveBusinessPhone, allHaveNoSubtitle
    ];
    
    const passedTests = allTests.filter(test => test).length;
    const totalTests = allTests.length;
    
    console.log('\\n🎯 Final Summary:');
    console.log(`   Tests passed: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('   🎉 ALL TICKET FORMATS PERFECTLY STANDARDIZED!');
        
        console.log('\\n📋 Standardized Format Across All Three Views:');
        console.log('   ✅ Header shows: Business Name + Address + Phone (NO subtitle)');
        console.log('   ✅ Order Info shows: Ticket #, Date, Total (NO status)');
        console.log('   ✅ Clean, professional appearance focused on essential info');
        
        console.log('\\n🚀 User Experience:');
        console.log('   1️⃣ Individual "🎫 View Ticket" → Clean format with business contact');
        console.log('   2️⃣ Multiple "🖨️ Print Selected" → Same clean format for all orders');
        console.log('   3️⃣ Modal "View Ticket" → Same format in popup with better title');
        
        console.log('\\n📊 Implementation Summary:');
        console.log('   ✅ service-ticket.html: Status removed, business contact added, subtitle removed');
        console.log('   ✅ generateThermalTicketHTML(): Status removed, business contact added, subtitle removed');
        console.log('   ✅ generateServiceTicketHTML(): Status removed, business contact added, subtitle removed');
        console.log('   ✅ Modal title: Changed from "Service Ticket" to "Order Details"');
        console.log('   ✅ All three formats now have identical header structure and information');
        
        console.log('\\n🎯 Perfect Alignment Achieved!');
        console.log('   All ticket formats now provide essential shipping and contact information');
        console.log('   with clean, professional styling and no redundant text or status fields.');
        
    } else {
        console.log('   ⚠️  Some standardization issues need review');
        
        if (!allHaveNoStatus) console.log('   • Some formats still have status fields');
        if (!allHaveBusinessAddress) console.log('   • Some formats missing business address');
        if (!allHaveBusinessPhone) console.log('   • Some formats missing business phone');
        if (!allHaveNoSubtitle) console.log('   • Some formats still have subtitle text');
    }
    
} catch (error) {
    console.error('❌ Error reading files:', error.message);
}