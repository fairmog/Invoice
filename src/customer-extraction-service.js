import SupabaseDatabase from './supabase-database.js';
import AIDataExtractor from './ai-extractor.js';

class CustomerExtractionService {
  constructor(database = null, aiExtractor = null) {
    this.database = database || new SupabaseDatabase();
    this.aiExtractor = aiExtractor || new AIDataExtractor();
  }

  /**
   * Extract customer data from a paid invoice and create/update customer record
   * This is the main entry point called when an invoice status changes to 'paid'
   */
  async extractFromPaidInvoice(invoice) {
    try {
      console.log(`🔍 Extracting customer data from paid invoice ${invoice.invoice_number}`);
      
      // Build customer data from invoice fields
      const extractedCustomerData = {
        name: invoice.customer_name,
        email: invoice.customer_email,
        phone: invoice.customer_phone,
        address: invoice.customer_address
      };

      // Validate that we have minimum required data
      if (!extractedCustomerData.name && !extractedCustomerData.email && !extractedCustomerData.phone) {
        console.log(`⚠️ Insufficient customer data in invoice ${invoice.invoice_number}, skipping extraction`);
        return { success: false, reason: 'insufficient_data' };
      }

      // Use existing smart matching to find or create customer
      const customer = await this.database.findOrCreateCustomer({
        name: extractedCustomerData.name || 'Unknown Customer',
        email: extractedCustomerData.email || null,
        phone: extractedCustomerData.phone || null,
        address: extractedCustomerData.address || null,
        source_invoice_id: invoice.id,
        source_invoice_number: invoice.invoice_number,
        first_invoice_date: invoice.invoice_date || new Date().toISOString(),
        last_invoice_date: invoice.invoice_date || new Date().toISOString(),
        invoice_count: 1,
        total_spent: invoice.grand_total || 0
      });

      // If this is an existing customer, update their stats
      if (customer.id) {
        await this.updateCustomerStats(customer, invoice);
      }

      console.log(`✅ Customer data processed successfully: ${customer.name} (ID: ${customer.id})`);
      
      return {
        success: true,
        customer: customer,
        isNew: !customer.source_invoice_id || customer.source_invoice_id === invoice.id,
        action: customer.source_invoice_id === invoice.id ? 'created' : 'updated'
      };

    } catch (error) {
      console.error(`❌ Error extracting customer from invoice ${invoice.invoice_number}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update customer statistics when a new invoice is paid
   */
  async updateCustomerStats(customer, newInvoice) {
    try {
      // Get all invoices for this customer
      const customerInvoices = this.database.data.invoices.filter(inv => 
        inv.status === 'paid' && 
        (inv.customer_email === customer.email || inv.customer_phone === customer.phone)
      );

      // Calculate updated stats
      const invoiceCount = customerInvoices.length;
      const totalSpent = customerInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
      const firstInvoiceDate = customerInvoices
        .sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date))[0]?.invoice_date;
      const lastInvoiceDate = customerInvoices
        .sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date))[0]?.invoice_date;

      // Update customer record
      await this.database.updateCustomer(customer.id, {
        invoice_count: invoiceCount,
        total_spent: totalSpent,
        first_invoice_date: firstInvoiceDate,
        last_invoice_date: lastInvoiceDate,
        updated_at: new Date().toISOString()
      });

      console.log(`📊 Updated customer stats: ${customer.name} - ${invoiceCount} invoices, ${totalSpent.toLocaleString('id-ID')} total`);
      
    } catch (error) {
      console.error('Error updating customer stats:', error);
    }
  }

  /**
   * Enhanced extraction using AI for complex cases
   * This can be used for invoices with unstructured customer data
   */
  async extractWithAI(rawText, invoice) {
    try {
      console.log(`🤖 Using AI to extract customer data from invoice ${invoice.invoice_number}`);
      
      // Use existing AI extraction
      const aiResult = await this.aiExtractor.extractCustomerData(rawText);
      
      if (aiResult.success && aiResult.customer) {
        // Merge AI extracted data with invoice data, preferring invoice data when available
        const mergedData = {
          name: invoice.customer_name || aiResult.customer.name,
          email: invoice.customer_email || aiResult.customer.email,
          phone: invoice.customer_phone || aiResult.customer.phone,
          address: invoice.customer_address || aiResult.customer.address
        };

        return await this.database.findOrCreateCustomer({
          ...mergedData,
          source_invoice_id: invoice.id,
          source_invoice_number: invoice.invoice_number,
          extraction_method: 'ai_enhanced',
          first_invoice_date: invoice.invoice_date || new Date().toISOString(),
          last_invoice_date: invoice.invoice_date || new Date().toISOString()
        });
      }
      
      return { success: false, reason: 'ai_extraction_failed' };
      
    } catch (error) {
      console.error('AI customer extraction error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find customer by email or phone for invoice generation
   * This helps auto-populate customer data in new invoices
   */
  async findExistingCustomer(email, phone) {
    try {
      // Try email match first
      if (email) {
        const emailCustomer = await this.database.getCustomer(email);
        if (emailCustomer) {
          console.log(`👤 Found existing customer by email: ${emailCustomer.name}`);
          return emailCustomer;
        }
      }

      // Try phone match
      if (phone) {
        const normalizedPhone = this.database.normalizePhone(phone);
        const phoneCustomer = this.database.data.customers.find(c => 
          c.phone && this.database.normalizePhone(c.phone) === normalizedPhone
        );
        if (phoneCustomer) {
          console.log(`👤 Found existing customer by phone: ${phoneCustomer.name}`);
          return phoneCustomer;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding existing customer:', error);
      return null;
    }
  }

  /**
   * Get customer insights for dashboard
   */
  async getCustomerInsights() {
    try {
      const customers = this.database.data.customers;
      const paidInvoices = this.database.data.invoices.filter(inv => inv.status === 'paid');
      
      return {
        totalCustomers: customers.length,
        newCustomersThisMonth: customers.filter(c => {
          const created = new Date(c.created_at);
          const now = new Date();
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }).length,
        topCustomers: customers
          .map(customer => {
            const customerInvoices = paidInvoices.filter(inv => 
              inv.customer_email === customer.email
            );
            return {
              ...customer,
              total_spent: customerInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0),
              invoice_count: customerInvoices.length
            };
          })
          .sort((a, b) => b.total_spent - a.total_spent)
          .slice(0, 10),
        averageOrderValue: paidInvoices.length > 0 ? 
          paidInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0) / paidInvoices.length : 0
      };
    } catch (error) {
      console.error('Error getting customer insights:', error);
      return {
        totalCustomers: 0,
        newCustomersThisMonth: 0,
        topCustomers: [],
        averageOrderValue: 0
      };
    }
  }
}

export default CustomerExtractionService;