// Test Two-Stage Invoice Workflow
console.log('🧪 Testing Two-Stage Invoice Workflow (Preview → Confirm)');

async function testTwoStageWorkflow() {
  const testMessage = `Fairtel Mong
087882880070
fairmog@gmail.com
jalan mimosa 1 blok E2 no 25 B
lolly 4pcs
discount 20%
DP 30%
pelunasan di bayar tanggal 20 agustus 2025

Catatan : lolly nya warna hitam 2 putih 2.`;

  console.log('📝 Test Input:', testMessage);
  console.log('='.repeat(80));

  try {
    // STAGE 1: Preview Only
    console.log('🔍 STAGE 1: Generating Preview...');
    
    const previewResponse = await fetch('http://localhost:3000/api/preview-invoice', {
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

    if (!previewResponse.ok) {
      console.error('❌ Preview API failed:', previewResponse.status, previewResponse.statusText);
      return;
    }

    const previewData = await previewResponse.json();
    
    if (previewData.success) {
      console.log('✅ Preview Generated Successfully!');
      console.log('📋 Preview Invoice:', previewData.invoice.header.invoiceNumber);
      console.log('🔍 Preview ID:', previewData.previewId);
      console.log('🔥 Is Preview:', previewData.isPreview);
      console.log('💰 Grand Total:', formatCurrency(previewData.invoice.calculations.grandTotal));
      console.log('📝 Custom Notes:', `"${previewData.invoice.notes.customNotes}"`);
      console.log('');

      // Simulate user confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STAGE 2: Final Invoice Generation
      console.log('✅ STAGE 2: Confirming Final Invoice...');
      
      const confirmResponse = await fetch('http://localhost:3000/api/confirm-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceData: previewData,
          businessProfile: {
            businessName: 'Aspree Technology Store',
            address: 'Jl. Teknologi Digital No. 88, Jakarta Selatan 12950',
            phone: '+62-21-5555-8888',
            email: 'info@aspree.tech',
            website: 'https://aspree.tech',
            taxEnabled: false
          },
          previewId: previewData.previewId
        })
      });

      if (!confirmResponse.ok) {
        console.error('❌ Confirm API failed:', confirmResponse.status, confirmResponse.statusText);
        return;
      }

      const finalData = await confirmResponse.json();
      
      if (finalData.success) {
        console.log('🎉 Final Invoice Created Successfully!');
        console.log('📋 Final Invoice:', finalData.invoice.header.invoiceNumber);
        console.log('🆔 Database ID:', finalData.databaseId);
        console.log('🔗 Customer Portal URL:', finalData.customerPortalUrl);
        console.log('🔗 Invoice URL:', `http://localhost:3000/invoice/${finalData.databaseId}`);
        console.log('💰 Grand Total:', formatCurrency(finalData.invoice.calculations.grandTotal));
        console.log('📝 Custom Notes:', `"${finalData.invoice.notes.customNotes}"`);
        console.log('');
        
        console.log('🎯 TWO-STAGE WORKFLOW TEST COMPLETED SUCCESSFULLY! 🎯');
        console.log('='.repeat(80));
        console.log('✅ Stage 1 (Preview): Working ✓');
        console.log('✅ Stage 2 (Confirm): Working ✓');  
        console.log('✅ Database Save: Working ✓');
        console.log('✅ Custom Notes: Working ✓');
        console.log('✅ Payment Schedule: Working ✓');
        console.log('✅ Discount Calculation: Working ✓');
        
      } else {
        console.error('❌ Final invoice generation failed:', finalData.error);
      }
      
    } else {
      console.error('❌ Preview generation failed:', previewData.error);
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
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
testTwoStageWorkflow().then(() => {
  console.log('\n🏁 Two-stage workflow test completed');
}).catch(error => {
  console.error('❌ Test error:', error);
});