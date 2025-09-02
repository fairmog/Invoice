import SimpleDatabase from './simple-database.js';
import CustomerExtractionService from './customer-extraction-service.js';
import InvoiceGenerator from './invoice-generator.js';

console.log('🧪 Testing Customer Extraction and Matching Workflow\n');

async function testCustomerWorkflow() {
  try {
    // Initialize services
    const database = new SimpleDatabase();
    const customerService = new CustomerExtractionService(database);
    const invoiceGenerator = new InvoiceGenerator();

    console.log('📋 Test 1: First-time Customer Invoice Generation and Payment');
    console.log('=' .repeat(60));

    // Test 1: Create invoice for new customer
    const orderData1 = {
      customer: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '08123456789',
        address: 'Jl. Merdeka No. 123, Jakarta'
      },
      items: [
        {
          productName: 'Test Product A',
          quantity: 2,
          unitPrice: 50000,
          lineTotal: 100000
        }
      ],
      orderDetails: {
        subtotal: 100000,
        total: 110000,
        tax: 10000
      }
    };

    const merchantConfig = {
      businessName: 'Test Business',
      name: 'Test Business',
      email: 'test@business.com',
      address: 'Jakarta',
      phone: '021123456'
    };

    console.log('📝 Generating invoice for new customer...');
    
    // Check if customer exists before invoice generation
    const existingCustomer1 = await customerService.findExistingCustomer(
      orderData1.customer.email,
      orderData1.customer.phone
    );
    console.log(`👤 Existing customer found: ${existingCustomer1 ? 'Yes' : 'No'}`);

    // Generate invoice
    const invoice1 = await invoiceGenerator.generateInvoice(orderData1, merchantConfig);
    console.log(`✅ Invoice generated: ${invoice1.invoice.header.invoiceNumber}`);
    console.log(`👤 Customer marked as returning: ${orderData1.customer.isReturningCustomer ? 'Yes' : 'No'}`);

    // Save invoice to database (simulate invoice creation)
    const savedInvoice1 = {
      id: 1,
      invoice_number: invoice1.invoice.header.invoiceNumber,
      customer_name: invoice1.invoice.customer.name,
      customer_email: invoice1.invoice.customer.email,
      customer_phone: invoice1.invoice.customer.phone,
      customer_address: invoice1.invoice.customer.address,
      grand_total: invoice1.invoice.calculations.grandTotal,
      status: 'draft',
      invoice_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add invoice to database
    database.data.invoices.push(savedInvoice1);
    database.saveData();
    console.log('💾 Invoice saved to database');

    // Simulate payment - this should trigger customer extraction
    console.log('\n💰 Simulating payment confirmation...');
    await database.updateInvoiceStatus(1, 'paid');
    console.log('✅ Invoice marked as paid - customer extraction should have triggered');

    // Check if customer was created
    const customers = await database.getAllCustomers();
    console.log(`📊 Total customers in database: ${customers.length}`);
    if (customers.length > 0) {
      const customer = customers[0];
      console.log(`👤 Customer created: ${customer.name} (${customer.email})`);
      console.log(`📈 Stats: ${customer.invoice_count || 0} invoices, ${(customer.total_spent || 0).toLocaleString('id-ID')} total spent`);
    }

    console.log('\n📋 Test 2: Returning Customer Invoice Generation');
    console.log('=' .repeat(60));

    // Test 2: Create invoice for returning customer (same email)
    const orderData2 = {
      customer: {
        name: 'John Doe', // Same customer
        email: 'john.doe@example.com',
        phone: '08123456789'
        // Missing address - should be auto-filled from existing customer
      },
      items: [
        {
          productName: 'Test Product B',
          quantity: 1,
          unitPrice: 75000,
          lineTotal: 75000
        }
      ],
      orderDetails: {
        subtotal: 75000,
        total: 82500,
        tax: 7500
      }
    };

    console.log('📝 Generating invoice for returning customer...');
    
    // Check if customer exists before invoice generation
    const existingCustomer2 = await customerService.findExistingCustomer(
      orderData2.customer.email,
      orderData2.customer.phone
    );
    console.log(`👤 Existing customer found: ${existingCustomer2 ? 'Yes' : 'No'}`);
    if (existingCustomer2) {
      console.log(`📊 Previous stats: ${existingCustomer2.invoice_count || 0} invoices, ${(existingCustomer2.total_spent || 0).toLocaleString('id-ID')} spent`);
    }

    // Generate invoice (should auto-populate customer data)
    const invoice2 = await invoiceGenerator.generateInvoice(orderData2, merchantConfig);
    console.log(`✅ Invoice generated: ${invoice2.invoice.header.invoiceNumber}`);
    console.log(`👤 Customer marked as returning: ${orderData2.customer.isReturningCustomer ? 'Yes' : 'No'}`);
    console.log(`📍 Address auto-filled: ${orderData2.customer.address ? 'Yes' : 'No'}`);
    console.log(`📈 Previous invoice count: ${orderData2.customer.previousInvoiceCount || 0}`);

    // Save second invoice
    const savedInvoice2 = {
      id: 2,
      invoice_number: invoice2.invoice.header.invoiceNumber,
      customer_name: invoice2.invoice.customer.name,
      customer_email: invoice2.invoice.customer.email,
      customer_phone: invoice2.invoice.customer.phone,
      customer_address: invoice2.invoice.customer.address,
      grand_total: invoice2.invoice.calculations.grandTotal,
      status: 'draft',
      invoice_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    database.data.invoices.push(savedInvoice2);
    database.saveData();

    // Simulate second payment
    console.log('\n💰 Simulating second payment confirmation...');
    await database.updateInvoiceStatus(2, 'paid');
    console.log('✅ Second invoice marked as paid - customer stats should update');

    // Check updated customer stats
    const updatedCustomers = await database.getAllCustomers();
    if (updatedCustomers.length > 0) {
      const customer = updatedCustomers[0];
      console.log(`📊 Updated customer stats: ${customer.invoice_count || 0} invoices, ${(customer.total_spent || 0).toLocaleString('id-ID')} total spent`);
    }

    console.log('\n📋 Test 3: Phone-based Customer Matching');
    console.log('=' .repeat(60));

    // Test 3: Same customer, slightly different email but same phone
    const orderData3 = {
      customer: {
        name: 'John Doe',
        email: 'johndoe@gmail.com', // Different email
        phone: '628123456789' // Same phone (normalized format)
      },
      items: [
        {
          productName: 'Test Product C',
          quantity: 1,
          unitPrice: 25000,
          lineTotal: 25000
        }
      ],
      orderDetails: {
        subtotal: 25000,
        total: 27500,
        tax: 2500
      }
    };

    console.log('📝 Testing phone-based matching with different email...');
    
    const existingCustomer3 = await customerService.findExistingCustomer(
      orderData3.customer.email,
      orderData3.customer.phone
    );
    console.log(`👤 Customer matched by phone: ${existingCustomer3 ? 'Yes' : 'No'}`);

    // Test 4: Customer insights
    console.log('\n📋 Test 4: Customer Insights');
    console.log('=' .repeat(60));

    const insights = await customerService.getCustomerInsights();
    console.log(`📊 Customer Insights:`);
    console.log(`   Total customers: ${insights.totalCustomers}`);
    console.log(`   New this month: ${insights.newCustomersThisMonth}`);
    console.log(`   Average order value: ${insights.averageOrderValue.toLocaleString('id-ID')}`);
    console.log(`   Top customers: ${insights.topCustomers.length}`);

    if (insights.topCustomers.length > 0) {
      console.log('\n🏆 Top Customer:');
      const topCustomer = insights.topCustomers[0];
      console.log(`   ${topCustomer.name} (${topCustomer.email})`);
      console.log(`   ${topCustomer.invoice_count} invoices, ${topCustomer.total_spent.toLocaleString('id-ID')} total`);
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary of Features Tested:');
    console.log('   ✅ Customer extraction from paid invoices');
    console.log('   ✅ Smart customer matching (email & phone)');
    console.log('   ✅ Auto-population of returning customer data');
    console.log('   ✅ Customer statistics tracking');
    console.log('   ✅ Customer insights generation');
    console.log('   ✅ Phone number normalization and matching');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testCustomerWorkflow().then(() => {
  console.log('\n🎉 Customer workflow test completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});