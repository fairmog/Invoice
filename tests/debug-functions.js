import fs from 'fs';

const dashboardContent = fs.readFileSync('./merchant-dashboard.html', 'utf8');

// Extract thermal function
const thermalFunctionMatch = dashboardContent.match(/function generateThermalTicketHTML[\s\S]*?(?=function|\s*$)/);
console.log('🔍 Thermal Function Found:', thermalFunctionMatch ? 'YES' : 'NO');
if (thermalFunctionMatch) {
    const content = thermalFunctionMatch[0];
    console.log('Length:', content.length);
    console.log('Has thermal-business-address:', content.includes('thermal-business-address'));
    console.log('Has businessSettings.address:', content.includes('businessSettings.address'));
    console.log('Thermal function (first 500 chars):', content.substring(0, 500));
}

// Extract modal function  
const modalFunctionMatch = dashboardContent.match(/function generateServiceTicketHTML[\s\S]*?(?=function|\s*$)/);
console.log('\n🔍 Modal Function Found:', modalFunctionMatch ? 'YES' : 'NO');
if (modalFunctionMatch) {
    const content = modalFunctionMatch[0];
    console.log('Length:', content.length);
    console.log('Has business-address:', content.includes('business-address'));
    console.log('Has businessSettings.address:', content.includes('businessSettings.address'));
    console.log('Modal function (first 500 chars):', content.substring(0, 500));
}