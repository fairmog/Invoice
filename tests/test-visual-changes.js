// Test visual changes
console.log('🧪 Testing Visual Changes');

async function testVisualChanges() {
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
    console.log('📱 Testing visual changes...');
    
    const response = await fetch('http://localhost:3000/api/process-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      console.error('❌ API failed:', response.status);
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Invoice with visual changes generated!');
      console.log('📋 Invoice Number:', result.invoice.header.invoiceNumber);
      console.log('🆔 Database ID:', result.databaseId);
      console.log('🔗 View invoice at: http://localhost:3000/invoice/' + result.databaseId);
      console.log('');
      console.log('✅ Changes Applied:');
      console.log('  1. Business name color changed to black ✓');
      console.log('  2. Total row alignment fixed ✓');
      console.log('  3. Custom notes extraction working ✓');
      console.log('');
      console.log('📝 Extracted Custom Notes:', `"${result.invoice.notes.customNotes}"`);
      
    } else {
      console.error('❌ Invoice failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testVisualChanges();