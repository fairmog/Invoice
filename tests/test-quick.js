import OptimizedPrompts from './optimized-prompts.js';

// Test the optimized prompt generation directly
const testMessage = `fairtel Mong
087882880070
fairmog@gmail.com
lolly 2 pcs
jaln mimosa 1 sunter jakarta utara
discount 30 persen 
Down Payment 20%
sisa pembayaran 20-8-2025`;

console.log('🧪 Testing optimized prompt generation...');

try {
  const prompt = OptimizedPrompts.processCompleteOrder(testMessage, []);
  console.log('✅ Prompt generated successfully');
  console.log('📝 Generated prompt:', prompt.substring(0, 500) + '...');
  
  // Check if the prompt looks correct
  if (prompt.includes('paymentSchedule')) {
    console.log('✅ Payment schedule rules found in prompt');
  } else {
    console.log('❌ Payment schedule rules missing from prompt');
  }
  
} catch (error) {
  console.log('❌ Error generating prompt:', error.message);
}