#!/usr/bin/env node

/**
 * Test Invoice Update Functionality
 * 
 * This test verifies that:
 * 1. First invoice generation creates a new invoice
 * 2. Second invoice generation with edits updates the existing invoice (no duplicate)
 * 3. The invoice shows up correctly in the merchant dashboard
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testInvoiceUpdate() {
  console.log('🧪 Testing Invoice Update Functionality');
  console.log('=' .repeat(50));

  try {
    // Test message for invoice generation
    const testMessage = `Saya mau buat invoice untuk:
1. Laptop Gaming - 1 unit - Rp 15,000,000
2. Mouse Gaming - 2 unit - Rp 500,000

Customer: John Doe
Email: john@example.com
Phone: 08123456789
Address: Jakarta`;

    const businessProfile = {
      name: "Test Store",
      email: "test@store.com",
      phone: "08111222333",
      address: "Test Address"
    };

    // STEP 1: Generate preview
    console.log('🔍 STEP 1: Generating invoice preview...');
    const previewResponse = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: testMessage,
        businessProfile
      })
    });

    if (!previewResponse.ok) {
      throw new Error(`Preview failed: ${previewResponse.status}`);
    }

    const previewData = await previewResponse.json();
    console.log('✅ Preview generated successfully');
    console.log(`📄 Invoice Number: ${previewData.invoice.header.invoiceNumber}`);

    // STEP 2: Create final invoice (first time)
    console.log('\n💾 STEP 2: Creating final invoice (first time)...');
    const createResponse = await fetch(`${BASE_URL}/api/confirm-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoiceData: previewData,
        businessProfile,
        previewId: previewData.previewId
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Create failed: ${createResponse.status}`);
    }

    const createData = await createResponse.json();
    console.log('✅ First invoice created successfully');
    console.log(`📊 Database ID: ${createData.databaseId}`);
    console.log(`📄 Invoice Number: ${createData.invoice.header.invoiceNumber}`);

    const invoiceId = createData.databaseId;
    const originalInvoiceNumber = createData.invoice.header.invoiceNumber;

    // STEP 3: Modify invoice and update (simulate user editing)
    console.log('\n📝 STEP 3: Updating existing invoice...');
    
    // Modify the invoice data (simulate editing)
    const modifiedData = {
      ...createData,
      invoice: {
        ...createData.invoice,
        items: [
          ...createData.invoice.items,
          {
            productName: "Keyboard Gaming",
            description: "Added item",
            quantity: 1,
            unitPrice: 800000,
            lineTotal: 800000,
            taxRate: 11,
            taxAmount: 88000
          }
        ]
      }
    };

    // Recalculate totals
    const subtotal = modifiedData.invoice.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalTax = modifiedData.invoice.items.reduce((sum, item) => sum + item.taxAmount, 0);
    modifiedData.invoice.calculations = {
      ...modifiedData.invoice.calculations,
      subtotal: subtotal,
      totalTax: totalTax,
      grandTotal: subtotal + totalTax
    };

    const updateResponse = await fetch(`${BASE_URL}/api/confirm-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoiceId: invoiceId, // This is the key - sending the existing invoice ID
        invoiceData: modifiedData,
        businessProfile,
        previewId: modifiedData.previewId
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Update failed: ${updateResponse.status}`);
    }

    const updateData = await updateResponse.json();
    console.log('✅ Invoice updated successfully');
    console.log(`📊 Database ID: ${updateData.databaseId} (should be same as before)`);
    console.log(`📄 Invoice Number: ${updateData.invoice.header.invoiceNumber} (should be same as before)`);

    // STEP 4: Verify no duplicates created
    console.log('\n🔍 STEP 4: Verifying no duplicates in database...');
    const dashboardResponse = await fetch(`${BASE_URL}/api/invoices`);
    
    if (!dashboardResponse.ok) {
      throw new Error(`Dashboard fetch failed: ${dashboardResponse.status}`);
    }

    const dashboardData = await dashboardResponse.json();
    const invoicesWithSameNumber = dashboardData.invoices.filter(
      inv => inv.invoice_number === originalInvoiceNumber
    );

    console.log(`📊 Total invoices in database: ${dashboardData.invoices.length}`);
    console.log(`📊 Invoices with number ${originalInvoiceNumber}: ${invoicesWithSameNumber.length}`);

    // STEP 5: Results
    console.log('\n🎯 TEST RESULTS:');
    console.log('=' .repeat(50));
    
    if (invoiceId === updateData.databaseId) {
      console.log('✅ PASS: Same database ID used (no new record created)');
    } else {
      console.log('❌ FAIL: Different database IDs - new record was created!');
      console.log(`   Original ID: ${invoiceId}`);
      console.log(`   Update ID: ${updateData.databaseId}`);
    }

    if (originalInvoiceNumber === updateData.invoice.header.invoiceNumber) {
      console.log('✅ PASS: Same invoice number preserved');
    } else {
      console.log('❌ FAIL: Invoice number changed');
      console.log(`   Original: ${originalInvoiceNumber}`);
      console.log(`   Updated: ${updateData.invoice.header.invoiceNumber}`);
    }

    if (invoicesWithSameNumber.length === 1) {
      console.log('✅ PASS: No duplicate invoices created');
    } else {
      console.log(`❌ FAIL: ${invoicesWithSameNumber.length} invoices found with same number`);
    }

    if (modifiedData.invoice.items.length === updateData.invoice.items.length) {
      console.log('✅ PASS: Invoice items updated correctly');
    } else {
      console.log('❌ FAIL: Invoice items not updated properly');
    }

    console.log('\n🎉 Test completed successfully!');
    console.log(`🔗 View invoice in dashboard: ${BASE_URL}/merchant-dashboard.html`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testInvoiceUpdate().catch(console.error);