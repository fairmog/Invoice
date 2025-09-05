import WhatsAppInvoiceGenerator from './whatsapp-invoice-generator.js';
import config from './config.js';

// Test down payment detection
const testMessage = `fairtel Mong
087882880070
fairmog@gmail.com
lolly 2 pcs
jaln mimosa 1 sunter jakarta utara
discount 30 persen 
Down Payment 20%
sisa pembayaran 20-8-2025`;

const merchantConfig = {
  businessName: "Test Store",
  address: "Test Address",
  phone: "123456789",
  email: "test@test.com",
  catalog: []
};

console.log('🧪 Testing down payment detection...');
console.log('📝 Test message:', testMessage);
console.log('=' .repeat(50));

const generator = new WhatsAppInvoiceGenerator();

try {
  const result = await generator.processWhatsAppMessage(testMessage, merchantConfig);
  
  if (result.success) {
    console.log('✅ Invoice generation successful!');
    
    // Check if payment schedule is in the invoice
    if (result.invoice.paymentSchedule) {
      console.log('🎉 SUCCESS: Payment schedule found in invoice!');
      console.log('📊 Payment schedule:', JSON.stringify(result.invoice.paymentSchedule, null, 2));
    } else {
      console.log('❌ ISSUE: No payment schedule in generated invoice');
      console.log('🔍 Invoice structure:', Object.keys(result.invoice));
    }
  } else {
    console.log('❌ Invoice generation failed:', result.error);
  }
} catch (error) {
  console.log('❌ Test failed:', error.message);
}