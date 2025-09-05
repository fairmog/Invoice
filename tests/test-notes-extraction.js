// Test automatic custom notes extraction
console.log('🧪 Testing Automatic Notes Extraction');

async function testNotesExtraction() {
  const testMessage = `Fairtel Mong
087882880070
fairmog@gmail.com
jalan mimosa 1 blok E2 no 25 B
lolly 4pcs
discount 20%
DP 30%
pelunasan di bayar tanggal 20 agustus 2025

Catatan : lolly nya warna hitam 2 putih 2.`;

  try {
    console.log('📱 Testing message with automatic notes extraction...');
    console.log('Input:', testMessage);
    console.log('='.repeat(60));
    
    const response = await fetch('http://localhost:3000/api/process-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessage,
        businessProfile: {
          businessName: 'Aspree Technology Store',
          address: 'Jl. Teknologi Digital No. 88, Jakarta Selatan 12950',
          phone: '+62-21-5555-8888',
          email: 'info@aspree.tech',
          website: 'https://aspree.tech',
          taxEnabled: false
        }
      })
    });

    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      return;
    }

    const result = await response.json();
    
    if (result.success && result.invoice) {
      console.log('✅ Invoice generated successfully!');
      console.log('📋 Invoice Number:', result.invoice.header.invoiceNumber);
      console.log('🆔 Database ID:', result.databaseId);
      console.log('');
      
      console.log('📊 Extracted Information:');
      console.log('- Customer:', result.invoice.customer.name);
      console.log('- Email:', result.invoice.customer.email);
      console.log('- Phone:', result.invoice.customer.phone);
      console.log('- Address:', result.invoice.customer.address);
      console.log('');
      
      console.log('🛍️ Items & Pricing:');
      result.invoice.items.forEach((item, i) => {
        console.log(`${i+1}. ${item.productName} - Qty: ${item.quantity} @ ${formatCurrency(item.unitPrice)}`);
      });
      console.log('');
      
      console.log('💰 Financial Details:');
      console.log('- Subtotal:', formatCurrency(result.invoice.calculations.subtotal));
      console.log('- Discount:', `${formatCurrency(result.invoice.calculations.discount)} (${result.invoice.calculations.discountType})`);
      console.log('- Grand Total:', formatCurrency(result.invoice.calculations.grandTotal));
      console.log('');
      
      console.log('📅 Payment Schedule:');
      if (result.invoice.paymentSchedule) {
        console.log('- Down Payment:', `${result.invoice.paymentSchedule.downPayment.percentage}% = ${formatCurrency(result.invoice.paymentSchedule.downPayment.amount)}`);
        console.log('- Down Payment Due:', result.invoice.paymentSchedule.downPayment.dueDate);
        console.log('- Final Payment:', formatCurrency(result.invoice.paymentSchedule.remainingBalance.amount));
        console.log('- Final Payment Due:', result.invoice.paymentSchedule.remainingBalance.dueDate);
      }
      console.log('');
      
      console.log('📝 CUSTOM NOTES EXTRACTION TEST:');
      console.log('='.repeat(40));
      console.log('Expected Notes: "lolly nya warna hitam 2 putih 2."');
      console.log('Actual Notes:', `"${result.invoice.notes.customNotes}"`);
      
      const notesCorrect = result.invoice.notes.customNotes.includes('lolly nya warna hitam 2 putih 2');
      console.log('✅ Notes Extraction:', notesCorrect ? '✅ SUCCESS' : '❌ FAILED');
      
      if (notesCorrect) {
        console.log('🎉 Automatic notes extraction is working perfectly!');
        console.log('🔗 View the invoice with custom notes at:', `http://localhost:3000/invoice/${result.databaseId}`);
      }
      
    } else {
      console.error('❌ Invoice generation failed:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0).replace('IDR', 'Rp');
}

// Run the test
testNotesExtraction().then(() => {
  console.log('\n🏁 Notes extraction test completed');
}).catch(error => {
  console.error('❌ Test error:', error);
});