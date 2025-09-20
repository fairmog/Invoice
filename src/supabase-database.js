import { createClient } from '@supabase/supabase-js';
import cryptoHelper from '../utils/crypto-helper.js';

class SupabaseDatabase {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  // Product CRUD operations
  async createProduct(productData, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for product creation');
    }

    const { data, error } = await this.supabase
      .from('products')
      .insert({
        sku: productData.sku,
        name: productData.name,
        description: productData.description || '',
        category: productData.category || '',
        unit_price: productData.unit_price,
        cost_price: productData.cost_price || 0,
        stock_quantity: productData.stock_quantity || 0,
        min_stock_level: productData.min_stock_level || 0,
        is_active: productData.is_active !== undefined ? productData.is_active : true,
        tax_rate: productData.tax_rate || 0,
        dimensions: productData.dimensions || '',
        weight: productData.weight || null,
        image_url: productData.image_url || '',
        merchant_id: merchantId
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('UNIQUE constraint failed: products.sku');
      }
      throw error;
    }

    return { lastInsertRowid: data.id };
  }

  async getProduct(id) {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getProductBySku(sku) {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getAllProducts(limit = 50, offset = 0, category = null, active_only = true, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for product access');
    }

    let query = this.supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchantId);

    if (active_only) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  async searchProducts(searchTerm, category = null, priceMin = null, priceMax = null, active_only = true, limit = 50, offset = 0, merchantId = null) {
    let query = this.supabase
      .from('products')
      .select('*');

    // CRITICAL: Add merchant filtering first
    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    if (active_only) {
      query = query.eq('is_active', true);
    }

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (priceMin !== null) {
      query = query.gte('unit_price', priceMin);
    }

    if (priceMax !== null) {
      query = query.lte('unit_price', priceMax);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      products: data || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  async updateProduct(id, productData, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for product updates');
    }

    const { data, error } = await this.supabase
      .from('products')
      .update({
        name: productData.name,
        description: productData.description || '',
        category: productData.category || '',
        unit_price: productData.unit_price,
        cost_price: productData.cost_price || 0,
        stock_quantity: productData.stock_quantity || 0,
        min_stock_level: productData.min_stock_level || 0,
        is_active: productData.is_active !== undefined ? productData.is_active : true,
        tax_rate: productData.tax_rate || 0,
        dimensions: productData.dimensions || '',
        weight: productData.weight || null,
        image_url: productData.image_url || ''
      })
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select();

    if (error) throw error;
    return { changes: data ? data.length : 0 };
  }

  async deleteProduct(id, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for product deletion');
    }

    const { data, error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select();

    if (error) throw error;
    return { changes: data ? data.length : 0 };
  }

  // Customer operations
  async saveCustomer(customerData, merchantId) {
    try {
      if (!merchantId) {
        throw new Error('Merchant ID is required for customer creation');
      }

      console.log('👤 Saving customer:', {
        name: customerData.name,
        email: customerData.email,
        hasPhone: !!customerData.phone,
        merchantId
      });

      // Allow customers with phone number if email is missing
      if (!customerData.name || (!customerData.email && !customerData.phone)) {
        throw new Error('Customer name and either email or phone number are required');
      }

      // Look up existing customer by email or phone with better duplicate prevention
      let existing = null;
      let selectError = null;

      // Get all customers for this merchant to check for duplicates more thoroughly
      const { data: allCustomers, error: fetchError } = await this.supabase
        .from('customers')
        .select('*')
        .eq('merchant_id', merchantId);

      if (fetchError) {
        selectError = fetchError;
      } else if (allCustomers) {
        // Check for existing customer by email first (most reliable)
        if (customerData.email) {
          existing = allCustomers.find(c => c.email === customerData.email);
        }

        // If no email match and we have a phone, check by normalized phone
        if (!existing && customerData.phone) {
          const normalizedPhone = this.normalizePhone(customerData.phone);
          existing = allCustomers.find(c =>
            c.phone && this.normalizePhone(c.phone) === normalizedPhone
          );
        }
      }

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('💥 Error checking existing customer:', selectError.message);
        throw selectError;
      }

      if (existing) {
        // Update existing customer
        console.log('🔄 Updating existing customer with ID:', existing.id);
        const updateData = {
          name: customerData.name,
          phone: customerData.phone || existing.phone,
          address: customerData.address || existing.address,
          last_invoice_date: new Date().toISOString()
        };

        // Only increment invoice count if this is from an invoice (has source_invoice_id)
        if (customerData.source_invoice_id) {
          updateData.invoice_count = (existing.invoice_count || 0) + 1;
        }

        // Only update email if provided
        if (customerData.email) {
          updateData.email = customerData.email;
        }

        const { data, error } = await this.supabase
          .from('customers')
          .update(updateData)
          .eq('id', existing.id)
          .eq('merchant_id', merchantId)
          .select()
          .single();

        if (error) {
          console.error('💥 Error updating customer:', error.message);
          throw error;
        }
        console.log('✅ Customer updated successfully');
        return { insertedId: data.id, lastInsertRowid: data.id };
      } else {
        // Create new customer
        console.log('✨ Creating new customer');
        const { data, error } = await this.supabase
          .from('customers')
          .insert({
            name: customerData.name || '',
            email: customerData.email,
            phone: customerData.phone || null,
            address: customerData.address || null,
            source_invoice_id: customerData.source_invoice_id || null,
            source_invoice_number: customerData.source_invoice_number || null,
            first_invoice_date: new Date().toISOString(),
            last_invoice_date: new Date().toISOString(),
          invoice_count: customerData.invoice_count || 0,
          total_spent: customerData.total_spent || 0,
          extraction_method: customerData.extraction_method || 'manual',
          merchant_id: merchantId
        })
        .select()
        .single();

        if (error) {
          console.error('💥 Error creating customer:', error.message);
          throw error;
        }
        console.log('✅ Customer created successfully');
        return { insertedId: data.id, lastInsertRowid: data.id };
      }
    } catch (error) {
      console.error('💥 saveCustomer failed:', error.message);
      throw error;
    }
  }

  async getCustomer(email, merchantId = null) {
    let query = this.supabase
      .from('customers')
      .select('*')
      .eq('email', email);

    // Filter by merchant if provided
    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findOrCreateCustomer(customerData, merchantId = null) {
    const { name, email, phone } = customerData;

    if (!merchantId) {
      throw new Error('Merchant ID is required for customer operations');
    }

    // Validate that we have minimum required data
    if (!name || (!email && !phone)) {
      throw new Error('Customer name and either email or phone number are required');
    }

    // Try email match first
    if (email && this.isValidEmail(email)) {
      const { data: emailMatch, error: emailError } = await this.supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (emailError && emailError.code !== 'PGRST116') {
        console.error('Error checking email match:', emailError);
      }

      if (emailMatch) {
        console.log(`✅ Customer matched by email: ${emailMatch.name}`);
        return emailMatch;
      }
    }

    // Try phone match
    if (phone && this.isValidPhone(phone)) {
      const normalizedPhone = this.normalizePhone(phone);
      const { data: customers, error: customersError } = await this.supabase
        .from('customers')
        .select('*')
        .eq('merchant_id', merchantId);

      if (customersError) {
        console.error('Error fetching customers for phone match:', customersError);
      } else {
        const phoneMatch = customers?.find(c =>
          c.phone && this.normalizePhone(c.phone) === normalizedPhone
        );

        if (phoneMatch) {
          console.log(`✅ Customer matched by phone: ${phoneMatch.name}`);
          return phoneMatch;
        }
      }
    }

    // Create new customer
    console.log(`➕ Creating new customer: ${name || 'Unknown'}`);
    const result = await this.saveCustomer(customerData, merchantId);
    const { data: newCustomer } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', result.insertedId)
      .single();

    return newCustomer;
  }

  normalizePhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('08')) return '628' + digits.substring(2);
    if (digits.startsWith('8') && digits.length >= 10) return '62' + digits;
    if (digits.startsWith('628')) return digits;
    if (digits.startsWith('62')) return digits;

    return digits;
  }

  isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');

    // Indonesian phone numbers should be at least 10 digits
    if (digits.length < 10) return false;

    // Check for valid Indonesian phone number patterns
    if (digits.startsWith('08') && digits.length >= 11) return true;
    if (digits.startsWith('8') && digits.length >= 10) return true;
    if (digits.startsWith('628') && digits.length >= 12) return true;
    if (digits.startsWith('62') && digits.length >= 11) return true;

    // Allow international numbers (10+ digits)
    return digits.length >= 10;
  }

  async getAllCustomers(limit = 50, offset = 0, searchTerm = null, merchantId = null) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for customer access');
    }

    try {
      let query = this.supabase
        .from('customers')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      
      // Apply search filter if provided
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
      }
      
      const { data: customers, error } = await query.range(offset, offset + limit - 1);
      if (error) throw error;
      
      if (!customers || customers.length === 0) {
        return [];
      }
      
      // Get invoices and orders for this merchant to calculate customer statistics
      const invoicesQuery = merchantId
        ? this.supabase.from('invoices').select('customer_email, customer_phone, grand_total, created_at').eq('merchant_id', merchantId)
        : this.supabase.from('invoices').select('customer_email, customer_phone, grand_total, created_at');

      const ordersQuery = merchantId
        ? this.supabase.from('orders').select('customer_email, customer_phone, total_amount, order_date, created_at').eq('merchant_id', merchantId)
        : this.supabase.from('orders').select('customer_email, customer_phone, total_amount, order_date, created_at');
      
      const [invoicesResult, ordersResult] = await Promise.all([invoicesQuery, ordersQuery]);
      
      if (invoicesResult.error) console.warn('Error fetching invoices for customer stats:', invoicesResult.error);
      if (ordersResult.error) console.warn('Error fetching orders for customer stats:', ordersResult.error);
      
      const allInvoices = invoicesResult.data || [];
      const allOrders = ordersResult.data || [];
      
      // Calculate statistics for each customer
      const customersWithStats = customers.map(customer => {
        // Match by email first (more reliable), then by phone if no email match
        let customerInvoices = [];
        let customerOrders = [];

        if (customer.email) {
          // Primary match by email
          customerInvoices = allInvoices.filter(i => i.customer_email === customer.email);
          customerOrders = allOrders.filter(o => o.customer_email === customer.email);
        } else if (customer.phone) {
          // Secondary match by normalized phone if no email
          const normalizedCustomerPhone = this.normalizePhone(customer.phone);
          customerInvoices = allInvoices.filter(i =>
            !i.customer_email && i.customer_phone && this.normalizePhone(i.customer_phone) === normalizedCustomerPhone
          );
          customerOrders = allOrders.filter(o =>
            !o.customer_email && o.customer_phone && this.normalizePhone(o.customer_phone) === normalizedCustomerPhone
          );
        }
        
        // Calculate total spent from both invoices and orders
        const invoiceSpent = customerInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
        const orderSpent = customerOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const totalSpent = invoiceSpent + orderSpent;

        const totalOrders = customerOrders.length;
        const totalInvoices = customerInvoices.length;
        const lastOrderDate = customerOrders.length > 0 ?
          customerOrders.sort((a, b) => new Date(b.order_date || b.created_at) - new Date(a.order_date || a.created_at))[0].order_date || customerOrders[0].created_at : null;

        // Calculate average order value based on total transactions (invoices + orders)
        const totalTransactions = totalInvoices + totalOrders;

        return {
          ...customer,
          total_spent: totalSpent,
          total_orders: totalOrders,
          total_invoices: totalInvoices,
          last_order_date: lastOrderDate,
          status: (totalOrders > 0 || totalInvoices > 0) ? 'active' : 'inactive',
          avg_order_value: totalTransactions > 0 ? totalSpent / totalTransactions : 0
        };
      });
      
      return customersWithStats;
    } catch (error) {
      console.error('Error in getAllCustomers:', error);
      throw error;
    }
  }

  async searchCustomers(searchTerm, merchantId = null, limit = 50, offset = 0) {
    try {
      // Use getAllCustomers which already has merchant filtering and search capability
      const customers = await this.getAllCustomers(limit, offset, searchTerm, merchantId);
      
      // Return in the expected format for search API
      return {
        customers: customers,
        total: customers.length,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(customers.length / limit)
      };
    } catch (error) {
      console.error('Error in searchCustomers:', error);
      throw error;
    }
  }

  // Invoice operations
  async saveInvoice(invoiceData, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for invoice creation');
    }
    try {
      console.log('💾 Saving invoice to database:', {
        hasInvoice: !!(invoiceData.invoice || invoiceData),
        hasCustomer: !!(invoiceData.invoice?.customer || invoiceData.customer),
        hasItems: !!(invoiceData.invoice?.items || invoiceData.items)
      });
      
      const customerToken = this.generateCustomerToken();
      const invoice = invoiceData.invoice || invoiceData;
      const invoiceNumber = await this.generateInvoiceNumber();
      
      console.log('🔍 DEBUG: Generated invoice number:', invoiceNumber);
      console.log('🔍 DEBUG: Generated customer token:', customerToken);
      
      // === ENHANCED DATA VALIDATION AND CALCULATION FIXES ===
      console.log('🔧 Validating and fixing invoice data before save...');
      console.log('🔍 DEBUG: Invoice structure check:', {
        hasMerchant: !!invoice.merchant,
        hasBusinessProfile: !!invoice.businessProfile,
        merchantEmail: invoice.merchant?.email,
        businessProfileEmail: invoice.businessProfile?.email,
        customerEmail: invoice.customer?.email
      });
      
      // Fix 1: Ensure due date is properly set
      if (!invoice.header) invoice.header = {};
      if (!invoice.header.dueDate || invoice.header.dueDate === '') {
        const invoiceDate = new Date(invoice.header.invoiceDate || Date.now());
        const dueDate = new Date(invoiceDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days later
        invoice.header.dueDate = dueDate.toISOString().split('T')[0];
        console.log('🗓️ Generated due date:', invoice.header.dueDate);
      }
      
      // Fix 2: Recalculate subtotal from items to match validation expectations
      if (invoice.items && Array.isArray(invoice.items)) {
        let calculatedSubtotal = 0;
        invoice.items.forEach((item, index) => {
          const quantity = parseFloat(item.quantity || 0);
          const unitPrice = parseFloat(item.unitPrice || item.unit_price || 0);
          const lineTotal = quantity * unitPrice;
          calculatedSubtotal += lineTotal;
          
          // Ensure item has consistent structure
          item.lineTotal = lineTotal;
          console.log(`📊 Item ${index + 1}: ${quantity} × ${unitPrice} = ${lineTotal}`);
        });
        
        // Update calculations object
        if (!invoice.calculations) invoice.calculations = {};
        invoice.calculations.subtotal = calculatedSubtotal;
        console.log('💰 Calculated subtotal from items:', calculatedSubtotal);
      }
      
      // Fix 3: Ensure proper tax calculation
      if (!invoice.calculations) invoice.calculations = {};
      const subtotal = parseFloat(invoice.calculations.subtotal || 0);
      const taxRate = parseFloat(invoice.calculations.taxRate || 0);
      const calculatedTax = subtotal * (taxRate / 100);
      invoice.calculations.totalTax = calculatedTax;
      
      // Fix 4: Recalculate grand total
      const shippingCost = parseFloat(invoice.calculations.shippingCost || 0);
      const discount = parseFloat(invoice.calculations.discount || 0);
      const grandTotal = subtotal + calculatedTax + shippingCost - discount;
      invoice.calculations.grandTotal = grandTotal;
      
      console.log('🧮 Final calculations:', {
        subtotal,
        tax: calculatedTax,
        shipping: shippingCost,
        discount,
        grandTotal
      });
      
      if (!invoice || !invoice.customer) {
        throw new Error('Invoice data or customer information is missing');
      }
      
      // Auto-create/update customer record
      try {
        await this.saveCustomer({
          name: invoice.customer.name,
          email: invoice.customer.email,
          phone: invoice.customer.phone,
          address: invoice.customer.address
        }, merchantId);
        console.log('✅ Customer record saved/updated');
      } catch (customerError) {
        console.error('⚠️ Warning: Failed to save customer record:', customerError.message);
        // Continue with invoice save even if customer save fails
      }
      
      const invoiceInsertData = {
        invoice_number: invoiceNumber,
        customer_name: invoice.customer?.name || '',
        customer_email: invoice.customer?.email || '',
        customer_phone: invoice.customer?.phone || '',
        customer_address: invoice.customer?.address || '',
        merchant_name: invoice.merchant?.businessName || invoice.businessProfile?.name || 'Unknown Merchant',
        merchant_address: invoice.merchant?.address || invoice.businessProfile?.address || '',
        merchant_phone: invoice.merchant?.phone || invoice.businessProfile?.phone || '',
        merchant_email: invoice.merchant?.email || invoice.businessProfile?.email || '',
        invoice_date: invoice.header?.invoiceDate || new Date().toISOString().split('T')[0],
        due_date: invoice.header.dueDate, // Now guaranteed to have value from validation above
        original_due_date: invoice.header.dueDate,
        status: 'draft',
        payment_stage: invoice.paymentSchedule ? 'down_payment' : 'full_payment',
        payment_status: 'pending',
        subtotal: invoice.calculations.subtotal, // Using validated/corrected values
        tax_amount: invoice.calculations.totalTax,
        shipping_cost: invoice.calculations.shippingCost || 0,
        discount: invoice.calculations.discount || 0,
        grand_total: invoice.calculations.grandTotal, // Using corrected grand total
        currency: invoice.calculations?.currency || invoice.summary?.currency || 'IDR',
        payment_terms: invoice.payment?.paymentTerms || 'Net 30',
        notes: invoice.notes?.publicNotes || '',
        items_json: invoice.items || [],
        metadata_json: {
          ...invoice.metadata,
          businessProfile: invoiceData.businessProfile || invoice.businessProfile || null
        },
        payment_schedule_json: invoice.paymentSchedule || null,
        notes_json: invoice.notes || {},
        calculations_json: invoice.calculations || {},
        customer_token: customerToken,
        merchant_id: merchantId
      };
      
      console.log('📋 Inserting invoice data:', {
        invoice_number: invoiceNumber,
        customer_name: invoiceInsertData.customer_name,
        merchant_name: invoiceInsertData.merchant_name,
        grand_total: invoiceInsertData.grand_total,
        itemsCount: Array.isArray(invoiceInsertData.items_json) ? invoiceInsertData.items_json.length : 0
      });
      
      console.log('📤 Attempting to insert invoice data...', {
        invoice_number: invoiceInsertData.invoice_number,
        customer_name: invoiceInsertData.customer_name,
        merchant_name: invoiceInsertData.merchant_name,
        merchant_email: invoiceInsertData.merchant_email,
        grand_total: invoiceInsertData.grand_total
      });

      const { data, error } = await this.supabase
        .from('invoices')
        .insert(invoiceInsertData)
        .select()
        .single();

      if (error) {
        console.error('💥 Invoice insert error:', error.message, error.details);
        console.error('💥 Full error object:', JSON.stringify(error, null, 2));
        console.error('💥 Failed insert data keys:', Object.keys(invoiceInsertData));
        throw error;
      }

      console.log('✅ Invoice saved successfully:', {
        id: data.id,
        invoice_number: data.invoice_number,
        grand_total: data.grand_total
      });

      // Extract and save customer data using CustomerExtractionService
      try {
        console.log('🧠 Extracting customer data from invoice...');
        const CustomerExtractionService = (await import('./customer-extraction-service.js')).default;
        const customerService = new CustomerExtractionService(this);
        await customerService.extractFromPaidInvoice(data);
        console.log('✅ Customer data extracted and saved successfully');
      } catch (extractionError) {
        console.error('⚠️ Warning: Customer extraction failed:', extractionError.message);
        // Continue with invoice save even if customer extraction fails
      }

      const returnObject = {
        ...data,
        invoiceNumber: invoiceNumber,
        customerToken
      };
      
      console.log('🔍 DEBUG: Return object structure:', {
        hasId: !!returnObject.id,
        hasInvoiceNumber: !!returnObject.invoiceNumber,
        invoiceNumberValue: returnObject.invoiceNumber,
        hasCustomerToken: !!returnObject.customerToken,
        customerTokenValue: returnObject.customerToken,
        dbInvoiceNumber: data.invoice_number
      });

      return returnObject;
    } catch (error) {
      console.error('💥 saveInvoice failed:', error.message);
      throw error;
    }
  }

  async getAllInvoices(limit = 50, offset = 0, status = null, customerEmail = null, dateFrom = null, dateTo = null, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for invoice access');
    }

    let query = this.supabase
      .from('invoices')
      .select('*')
      .eq('merchant_id', merchantId);

    if (status) {
      query = query.eq('status', status);
    }

    if (customerEmail) {
      query = query.eq('customer_email', customerEmail);
    }

    if (dateFrom) {
      query = query.gte('invoice_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('invoice_date', dateTo);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    
    // Normalize invoice items for all retrieved invoices
    const normalizedData = (data || []).map(invoice => {
      if (invoice && invoice.items_json) {
        invoice.items_json = this.normalizeInvoiceItems(invoice.items_json);
      }
      return invoice;
    });
    
    return normalizedData;
  }

  async getInvoice(id, merchantId = null) {
    let query = this.supabase
      .from('invoices')
      .select('*')
      .eq('id', id);
    
    // Add merchant filtering if merchantId is provided
    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }
    
    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Normalize invoice items if data exists
    if (data && data.items_json) {
      data.items_json = this.normalizeInvoiceItems(data.items_json);
    }
    
    return data;
  }

  async getInvoiceByNumber(invoiceNumber) {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Normalize invoice items if data exists
    if (data && data.items_json) {
      data.items_json = this.normalizeInvoiceItems(data.items_json);
    }
    
    return data;
  }

  async getInvoiceByCustomerToken(token) {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('customer_token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Normalize invoice items if data exists
    if (data && data.items_json) {
      data.items_json = this.normalizeInvoiceItems(data.items_json);
    }
    
    return data;
  }

  async getInvoiceByFinalPaymentToken(token) {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('final_payment_token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Normalize invoice items if data exists
    if (data && data.items_json) {
      data.items_json = this.normalizeInvoiceItems(data.items_json);
    }
    
    return data;
  }

  async updateInvoiceStatus(invoiceId, status, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for invoice status updates');
    }

    const updateData = { 
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    } else if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
      updateData.payment_status = 'paid'; // Ensure payment_status is also updated
    }

    const { data, error } = await this.supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) throw error;

    // Auto-create order and extract customer data if paid
    if (status === 'paid') {
      let orderResult = null;
      let customerExtractionResult = null;

      // 1. Auto-create order
      try {
        console.log(`💎 Invoice ${data.invoice_number || invoiceId} marked as paid - creating order automatically`);
        console.log(`🔍 Debug: Invoice ID: ${invoiceId}, Merchant ID: ${merchantId}`);
        console.log(`🔍 Debug: Invoice data:`, {
          id: data.id,
          invoice_number: data.invoice_number,
          customer_name: data.customer_name,
          grand_total: data.grand_total
        });

        orderResult = await this.createOrderFromInvoice(invoiceId, merchantId);
        console.log(`✅ Order ${orderResult.orderNumber} auto-created from paid invoice ${data.invoice_number || invoiceId}`);

        // Return extended data with order info
        data.orderCreated = true;
        data.orderNumber = orderResult.orderNumber;
        data.orderId = orderResult.lastInsertRowid;
      } catch (orderError) {
        console.error(`❌ Failed to auto-create order from invoice ${data.invoice_number || invoiceId}:`, {
          error: orderError.message,
          stack: orderError.stack,
          invoiceId,
          merchantId,
          errorType: orderError.constructor.name
        });

        // Add error info to return data
        data.orderCreated = false;
        data.orderError = orderError.message;
      }

      // 2. Extract customer data from paid invoice
      try {
        console.log(`👥 Extracting customer data from paid invoice ${data.invoice_number || invoiceId}`);
        const CustomerExtractionService = (await import('./customer-extraction-service.js')).default;
        const customerService = new CustomerExtractionService(this);
        customerExtractionResult = await customerService.extractFromPaidInvoice(data);

        if (customerExtractionResult.success) {
          console.log(`✅ Customer data extracted for invoice ${data.invoice_number}: ${customerExtractionResult.action}`);
        } else {
          console.log(`⚠️ Customer extraction skipped for invoice ${data.invoice_number}: ${customerExtractionResult.reason || customerExtractionResult.error}`);
        }
      } catch (customerError) {
        console.error(`❌ Customer extraction failed for invoice ${data.invoice_number || invoiceId}:`, customerError);
      }

      // Return comprehensive result
      if (orderResult) {
        return {
          ...data,
          orderCreated: true,
          orderId: orderResult.lastInsertRowid,
          orderNumber: orderResult.orderNumber,
          customerExtracted: customerExtractionResult?.success || false
        };
      } else {
        return {
          ...data,
          orderCreated: false,
          orderError: 'Order creation failed',
          customerExtracted: customerExtractionResult?.success || false
        };
      }
    }

    return { changes: 1 };
  }

  async deleteInvoice(id, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for invoice deletion');
    }

    const { data, error } = await this.supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) throw error;
    return { changes: 1, deletedInvoice: data };
  }

  async updateInvoice(invoiceId, updateData, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for invoice updates');
    }
    
    console.log(`🔄 Updating invoice ${invoiceId} with data:`, updateData);
    
    try {
      // Prepare update data - filter out undefined values and handle special fields
      const cleanUpdateData = {};
      
      // Standard fields that can be updated directly
      const allowedFields = [
        'status', 'payment_stage', 'payment_status', 'final_payment_token', 
        'final_payment_amount', 'due_date', 'original_due_date', 'dp_confirmed_date',
        'payment_schedule_json', 'invoice_number', 'customer_name', 'customer_email',
        'customer_phone', 'customer_address', 'business_profile_json', 'items_json',
        'subtotal_amount', 'tax_amount', 'total_amount', 'notes', 'terms',
        'sent_at', 'paid_at', 'updated_at'
      ];
      
      // Copy only allowed fields that are not undefined
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          cleanUpdateData[field] = updateData[field];
        }
      }
      
      // Always set updated_at if not already provided
      if (!cleanUpdateData.updated_at) {
        cleanUpdateData.updated_at = new Date().toISOString();
      }
      
      console.log(`🔄 Clean update data for invoice ${invoiceId}:`, cleanUpdateData);
      
      const { data, error } = await this.supabase
        .from('invoices')
        .update(cleanUpdateData)
        .eq('id', invoiceId)
        .eq('merchant_id', merchantId)
        .select()
        .single();

      if (error) {
        // Handle missing column errors gracefully
        if (error.code === 'PGRST204' && error.message?.includes("Could not find")) {
          console.log(`⚠️ Schema mismatch detected, attempting fallback update...`);
          
          // Remove columns that might not exist in the current schema
          const potentialMissingColumns = ['dp_confirmed_date', 'final_payment_token', 'final_payment_amount'];
          let fallbackData = { ...cleanUpdateData };
          
          for (const column of potentialMissingColumns) {
            if (error.message.includes(column)) {
              delete fallbackData[column];
              console.log(`⚠️ Removed ${column} from update due to missing column`);
            }
          }
          
          const { data: retryData, error: retryError } = await this.supabase
            .from('invoices')
            .update(fallbackData)
            .eq('id', invoiceId)
            .eq('merchant_id', merchantId)
            .select()
            .single();
            
          if (retryError) {
            console.error(`❌ Error updating invoice ${invoiceId} (retry):`, retryError);
            throw retryError;
          }
          
          console.log(`✅ Successfully updated invoice ${invoiceId} with schema fallback`);
          return { changes: 1, updatedInvoice: retryData };
        }
        
        console.error(`❌ Error updating invoice ${invoiceId}:`, error);
        throw error;
      }

      console.log(`✅ Successfully updated invoice ${invoiceId}`);
      return { changes: 1, updatedInvoice: data };
      
    } catch (error) {
      console.error(`❌ Failed to update invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  async getInvoiceStats(dateFrom = null, dateTo = null, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for invoice stats');
    }

    let query = this.supabase
      .from('invoices')
      .select('status, grand_total, created_at')
      .eq('merchant_id', merchantId);

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    const invoices = data || [];
    const stats = {
      total_invoices: invoices.length,
      draft_invoices: invoices.filter(i => i.status === 'draft').length,
      sent_invoices: invoices.filter(i => i.status === 'sent').length,
      paid_invoices: invoices.filter(i => i.status === 'paid').length,
      cancelled_invoices: invoices.filter(i => i.status === 'cancelled').length,
      total_revenue: invoices.filter(i => i.status === 'paid')
        .reduce((sum, invoice) => sum + parseFloat(invoice.grand_total || 0), 0),
      outstanding_amount: invoices.filter(i => i.status === 'sent')
        .reduce((sum, invoice) => sum + parseFloat(invoice.grand_total || 0), 0),
      draft_amount: invoices.filter(i => i.status === 'draft')
        .reduce((sum, invoice) => sum + parseFloat(invoice.grand_total || 0), 0)
    };

    return stats;
  }

  async bulkDeleteInvoices(invoiceIds) {
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return { changes: 0 };
    }

    const { data, error } = await this.supabase
      .from('invoices')
      .delete()
      .in('id', invoiceIds)
      .select();

    if (error) throw error;
    return { changes: data ? data.length : 0 };
  }

  // Business Settings operations
  async getBusinessSettings(merchantId = null) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for business settings access');
    }

    try {
      let query = this.supabase
        .from('business_settings')
        .select('*')
        .eq('merchant_id', merchantId);
      
      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('📋 No business settings found, returning empty object');
          return {};
        }
        console.error('💥 Error fetching business settings:', error.message);
        throw error;
      }
      
      console.log('✅ Business settings retrieved from database:', {
        hasName: !!data?.name,
        hasEmail: !!data?.email,
        hasLogoUrl: !!data?.logo_url,
        hasLogoPublicId: !!data?.logo_public_id
      });
      
      // Add field compatibility mapping for web-server.js
      if (data) {
        return {
          ...data,
          // Map snake_case to camelCase for compatibility
          taxId: data.tax_id,
          taxEnabled: data.tax_enabled,
          taxRate: data.tax_rate,
          taxName: data.tax_name,
          taxDescription: data.tax_description,
          hideBusinessName: data.hide_business_name,
          businessCode: data.business_code,
          termsAndConditions: data.terms_conditions,
          logoUrl: data.logo_url,
          logoPublicId: data.logo_public_id,
          logoFilename: data.logo_filename,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          // Premium branding fields
          premiumActive: data.premium_active,
          customHeaderText: data.custom_header_text,
          customHeaderLogoUrl: data.custom_header_logo_url,
          customHeaderLogoPublicId: data.custom_header_logo_public_id,
          customFooterLogoUrl: data.custom_footer_logo_url,
          customFooterLogoPublicId: data.custom_footer_logo_public_id,
          customHeaderBgColor: data.custom_header_bg_color,
          customFooterBgColor: data.custom_footer_bg_color,
          hideAspreeBranding: data.hide_aspree_branding
        };
      }
      
      return {};
    } catch (error) {
      console.error('💥 getBusinessSettings failed:', error.message);
      throw error;
    }
  }

  async updateBusinessSettings(settings, merchantId = null) {
    try {
      console.log('🏢 Updating business settings with data:', settings);
      
      // Map camelCase input fields to snake_case database fields
      const mappedSettings = {};
      
      if (settings.name !== undefined) mappedSettings.name = settings.name;
      if (settings.email !== undefined) mappedSettings.email = settings.email;
      if (settings.phone !== undefined) mappedSettings.phone = settings.phone;
      if (settings.address !== undefined) mappedSettings.address = settings.address;
      if (settings.website !== undefined) mappedSettings.website = settings.website;
      
      // Handle both field name formats
      if (settings.taxId !== undefined || settings.tax_id !== undefined) {
        mappedSettings.tax_id = settings.taxId || settings.tax_id;
      }
      if (settings.taxEnabled !== undefined || settings.tax_enabled !== undefined) {
        mappedSettings.tax_enabled = settings.taxEnabled !== undefined ? settings.taxEnabled : settings.tax_enabled;
      }
      if (settings.taxRate !== undefined || settings.tax_rate !== undefined) {
        mappedSettings.tax_rate = settings.taxRate !== undefined ? settings.taxRate : settings.tax_rate;
      }
      if (settings.taxName !== undefined || settings.tax_name !== undefined) {
        mappedSettings.tax_name = settings.taxName || settings.tax_name;
      }
      if (settings.taxDescription !== undefined || settings.tax_description !== undefined) {
        mappedSettings.tax_description = settings.taxDescription || settings.tax_description;
      }
      if (settings.hideBusinessName !== undefined || settings.hide_business_name !== undefined) {
        mappedSettings.hide_business_name = settings.hideBusinessName !== undefined ? settings.hideBusinessName : settings.hide_business_name;
      }
      if (settings.businessCode !== undefined || settings.business_code !== undefined) {
        mappedSettings.business_code = settings.businessCode || settings.business_code;
      }
      // Map terms and conditions field
      if (settings.termsAndConditions !== undefined || settings.terms_conditions !== undefined) {
        mappedSettings.terms_conditions = settings.termsAndConditions || settings.terms_conditions || null;
        console.log('📝 Terms and conditions mapped:', mappedSettings.terms_conditions);
      }
      if (settings.logoUrl !== undefined || settings.logo_url !== undefined) {
        mappedSettings.logo_url = settings.logoUrl || settings.logo_url || null;
      }
      if (settings.logoPublicId !== undefined || settings.logo_public_id !== undefined) {
        mappedSettings.logo_public_id = settings.logoPublicId || settings.logo_public_id || null;
      }
      if (settings.logoFilename !== undefined || settings.logo_filename !== undefined) {
        mappedSettings.logo_filename = settings.logoFilename || settings.logo_filename || null;
      }
      
      // Premium branding fields
      if (settings.premiumActive !== undefined || settings.premium_active !== undefined) {
        mappedSettings.premium_active = settings.premiumActive !== undefined ? settings.premiumActive : settings.premium_active;
      }
      if (settings.customHeaderText !== undefined || settings.custom_header_text !== undefined) {
        mappedSettings.custom_header_text = settings.customHeaderText || settings.custom_header_text || null;
      }
      if (settings.customHeaderLogoUrl !== undefined || settings.custom_header_logo_url !== undefined) {
        mappedSettings.custom_header_logo_url = settings.customHeaderLogoUrl || settings.custom_header_logo_url || null;
      }
      if (settings.customHeaderLogoPublicId !== undefined || settings.custom_header_logo_public_id !== undefined) {
        mappedSettings.custom_header_logo_public_id = settings.customHeaderLogoPublicId || settings.custom_header_logo_public_id || null;
      }
      if (settings.customFooterLogoUrl !== undefined || settings.custom_footer_logo_url !== undefined) {
        mappedSettings.custom_footer_logo_url = settings.customFooterLogoUrl || settings.custom_footer_logo_url || null;
      }
      if (settings.customFooterLogoPublicId !== undefined || settings.custom_footer_logo_public_id !== undefined) {
        mappedSettings.custom_footer_logo_public_id = settings.customFooterLogoPublicId || settings.custom_footer_logo_public_id || null;
      }
      if (settings.customHeaderBgColor !== undefined || settings.custom_header_bg_color !== undefined) {
        mappedSettings.custom_header_bg_color = settings.customHeaderBgColor || settings.custom_header_bg_color || '#311d6b';
      }
      if (settings.customFooterBgColor !== undefined || settings.custom_footer_bg_color !== undefined) {
        mappedSettings.custom_footer_bg_color = settings.customFooterBgColor || settings.custom_footer_bg_color || '#311d6b';
      }
      if (settings.hideAspreeBranding !== undefined || settings.hide_aspree_branding !== undefined) {
        mappedSettings.hide_aspree_branding = settings.hideAspreeBranding !== undefined ? settings.hideAspreeBranding : settings.hide_aspree_branding;
      }

      console.log('📋 Mapped settings for database:', mappedSettings);

      // Check if business settings exist for this merchant
      let existingQuery = this.supabase
        .from('business_settings')
        .select('*');
      
      if (merchantId) {
        existingQuery = existingQuery.eq('merchant_id', merchantId);
      } else {
        existingQuery = existingQuery.limit(1);
      }
      
      const { data: existing, error: selectError } = await existingQuery.single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('💥 Error checking existing business settings:', selectError.message);
        throw selectError;
      }

      let result;
      if (existing) {
        console.log('🔄 Updating existing business settings with ID:', existing.id);
        const { data, error } = await this.supabase
          .from('business_settings')
          .update(mappedSettings)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('💥 Error updating business settings:', error.message);
          throw error;
        }
        result = data;
      } else {
        console.log('✨ Creating new business settings record');
        // Add merchant_id to new records if provided
        if (merchantId) {
          mappedSettings.merchant_id = merchantId;
        }
        const { data, error } = await this.supabase
          .from('business_settings')
          .insert(mappedSettings)
          .select()
          .single();

        if (error) {
          console.error('💥 Error creating business settings:', error.message);
          throw error;
        }
        result = data;
      }
      
      console.log('✅ Business settings saved successfully:', {
        id: result.id,
        hasName: !!result.name,
        hasEmail: !!result.email,
        hasLogoUrl: !!result.logo_url
      });
      
      // Return with field mapping for compatibility
      return this.mapBusinessSettingsFields(result);
    } catch (error) {
      console.error('💥 updateBusinessSettings failed:', error.message);
      throw error;
    }
  }

  // Helper method for consistent field mapping
  mapBusinessSettingsFields(data) {
    if (!data) return data;
    
    return {
      ...data,
      // Map snake_case to camelCase for compatibility
      taxId: data.tax_id,
      taxEnabled: data.tax_enabled,
      taxRate: data.tax_rate,
      taxName: data.tax_name,
      taxDescription: data.tax_description,
      hideBusinessName: data.hide_business_name,
      businessCode: data.business_code,
      termsAndConditions: data.terms_conditions || null,
      logoUrl: data.logo_url,
      logoPublicId: data.logo_public_id,
      logoFilename: data.logo_filename,
      // Premium branding fields
      premiumActive: data.premium_active,
      customHeaderText: data.custom_header_text,
      customHeaderLogoUrl: data.custom_header_logo_url,
      customHeaderLogoPublicId: data.custom_header_logo_public_id,
      customFooterLogoUrl: data.custom_footer_logo_url,
      customFooterLogoPublicId: data.custom_footer_logo_public_id,
      customHeaderBgColor: data.custom_header_bg_color,
      customFooterBgColor: data.custom_footer_bg_color,
      hideAspreeBranding: data.hide_aspree_branding,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Order operations
  async createOrder(orderData, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for order creation');
    }

    const orderNumber = await this.generateOrderNumber();
    
    // Auto-create/update customer record
    await this.saveCustomer({
      name: orderData.customer_name,
      email: orderData.customer_email,
      phone: orderData.customer_phone,
      address: orderData.shipping_address || orderData.billing_address
    }, merchantId);
    
    const { data, error } = await this.supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: orderData.customer_id || null,
        customer_name: orderData.customer_name,
        customer_email: orderData.customer_email,
        customer_phone: orderData.customer_phone || '',
        status: orderData.status || 'pending',
        order_date: orderData.order_date || new Date().toISOString(),
        shipping_address: orderData.shipping_address || '',
        billing_address: orderData.billing_address || '',
        payment_method: orderData.payment_method || '',
        payment_status: orderData.payment_status || 'pending',
        subtotal: orderData.subtotal,
        tax_amount: orderData.tax_amount || 0,
        shipping_cost: orderData.shipping_cost || 0,
        discount: orderData.discount || 0,
        total_amount: orderData.total_amount,
        notes: orderData.notes || '',
        tracking_number: orderData.tracking_number || '',
        shipped_date: orderData.shipped_date || null,
        delivered_date: orderData.delivered_date || null,
        source_invoice_id: orderData.source_invoice_id || null,
        source_invoice_number: orderData.source_invoice_number || null,
        merchant_id: merchantId
      })
      .select()
      .single();

    if (error) throw error;

    // Save order items if provided
    if (orderData.items && Array.isArray(orderData.items)) {
      const orderItems = orderData.items.map(item => ({
        order_id: data.id,
        product_id: item.product_id,
        product_name: item.product_name || item.name,
        sku: item.sku || '',
        quantity: item.quantity,
        unit_price: item.unit_price || item.price,
        line_total: item.line_total || (item.quantity * (item.unit_price || item.price))
      }));

      const { error: itemsError } = await this.supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;
    }

    return { lastInsertRowid: data.id, orderNumber: orderNumber };
  }

  async createOrderFromInvoice(invoiceId, merchantId) {
    try {
      console.log(`🔄 Creating order from invoice ID ${invoiceId} for merchant ${merchantId}`);

      if (!merchantId) {
        throw new Error('Merchant ID is required for order creation');
      }

      const invoice = await this.getInvoice(invoiceId, merchantId);
      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found or access denied for merchant ${merchantId}`);
      }

      console.log(`📋 Processing invoice ${invoice.invoice_number} (${invoice.customer_name}, Rp ${parseFloat(invoice.grand_total || 0).toLocaleString()})`);
      console.log(`🔍 Invoice details:`, {
        id: invoice.id,
        status: invoice.status,
        payment_status: invoice.payment_status,
        items_count: Array.isArray(invoice.items_json) ? invoice.items_json.length : 0
      });

      // Check if order already exists for this merchant
      console.log(`🔍 Checking for existing order with source_invoice_id: ${invoiceId}, merchant_id: ${merchantId}`);
      const { data: existingOrder, error: existingOrderError } = await this.supabase
        .from('orders')
        .select('*')
        .eq('source_invoice_id', invoiceId)
        .eq('merchant_id', merchantId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error when no record found

      if (existingOrderError) {
        console.warn(`⚠️ Error checking existing order:`, existingOrderError);
      }

      if (existingOrder) {
        console.log(`✅ Order ${existingOrder.order_number} already exists for invoice ${invoice.invoice_number}`);
        return { lastInsertRowid: existingOrder.id, orderNumber: existingOrder.order_number };
      }

      console.log(`🆕 No existing order found, creating new order...`);

    // Parse items safely
    let invoiceItems = [];
    try {
      if (Array.isArray(invoice.items_json)) {
        invoiceItems = invoice.items_json;
      } else if (typeof invoice.items_json === 'string') {
        invoiceItems = JSON.parse(invoice.items_json);
      } else {
        console.warn(`⚠️ Invoice items_json is not an array or string:`, typeof invoice.items_json);
        invoiceItems = [];
      }
    } catch (itemsError) {
      console.error(`❌ Error parsing invoice items:`, itemsError);
      invoiceItems = [];
    }

    console.log(`🛍️ Parsed ${invoiceItems.length} items from invoice`);

    const orderData = {
      customer_name: invoice.customer_name || 'Unknown Customer',
      customer_email: invoice.customer_email || '',
      customer_phone: invoice.customer_phone || '',
      shipping_address: invoice.customer_address || '',
      billing_address: invoice.customer_address || '',
      status: 'pending',
      payment_status: 'paid',
      order_date: new Date().toISOString(),
      subtotal: parseFloat(invoice.subtotal || 0),
      tax_amount: parseFloat(invoice.tax_amount || 0),
      shipping_cost: parseFloat(invoice.shipping_cost || 0),
      discount: parseFloat(invoice.discount || 0),
      total_amount: parseFloat(invoice.grand_total || 0),
      notes: `Auto-created from paid invoice ${invoice.invoice_number}`,
      source_invoice_id: invoice.id,
      source_invoice_number: invoice.invoice_number,
      items: invoiceItems.map((item, index) => {
        const mappedItem = {
          product_name: item.productName || item.name || item.description || `Item ${index + 1}`,
          sku: item.sku || '',
          quantity: parseFloat(item.quantity || 1),
          unit_price: parseFloat(item.unitPrice || item.price || item.unit_price || 0),
          line_total: parseFloat(item.lineTotal || item.line_total || 0)
        };

        // Calculate line_total if not provided
        if (!mappedItem.line_total && mappedItem.quantity && mappedItem.unit_price) {
          mappedItem.line_total = mappedItem.quantity * mappedItem.unit_price;
        }

        return mappedItem;
      })
    };

    console.log(`📦 Order data prepared:`, {
      customer_name: orderData.customer_name,
      total_amount: orderData.total_amount,
      items_count: orderData.items.length,
      source_invoice_id: orderData.source_invoice_id
    });

    console.log(`🔧 Calling createOrder function...`);
    const result = await this.createOrder(orderData, merchantId);
    console.log(`✅ createOrder completed, result:`, result);
    
    // Update invoice metadata
    const metadata = invoice.metadata_json || {};
    metadata.auto_created_order_id = result.lastInsertRowid;
    metadata.auto_created_order_number = result.orderNumber;
    
    await this.supabase
      .from('invoices')
      .update({ metadata_json: metadata })
      .eq('id', invoiceId)
      .eq('merchant_id', merchantId);

      console.log(`✅ Order ${result.orderNumber} auto-created from invoice ${invoice.invoice_number}`);
      return result;

    } catch (error) {
      console.error(`❌ Failed to create order from invoice ${invoiceId}:`, {
        error: error.message,
        stack: error.stack,
        invoiceId,
        merchantId,
        timestamp: new Date().toISOString()
      });

      // Re-throw with more context
      throw new Error(`Order creation failed for invoice ${invoiceId}: ${error.message}`);
    }
  }

  // Utility methods
  generateCustomerToken() {
    return 'inv_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
  }

  async generateRandomHash(length = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const crypto = await import('crypto');
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, characters.length);
      result += characters[randomIndex];
    }
    
    return result;
  }

  async generateUniqueHash(prefix, date, length = 4) {
    const maxAttempts = 100;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const hash = await this.generateRandomHash(length);
      const fullNumber = `${prefix}-${date}-${hash}`;
      
      // Check if this hash already exists for invoices or orders
      const { data: existingInvoice } = await this.supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', fullNumber)
        .single();
        
      const { data: existingOrder } = await this.supabase
        .from('orders')
        .select('id')
        .eq('order_number', fullNumber)
        .single();
      
      if (!existingInvoice && !existingOrder) {
        return hash;
      }
      
      attempts++;
    }
    
    return Date.now().toString(36).substr(-4).toUpperCase();
  }

  async generateInvoiceNumber() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const dateString = `${year}${month}${day}`;
    const prefix = `INV`;
    
    const hash = await this.generateUniqueHash(prefix, dateString);
    
    return `${prefix}-${dateString}-${hash}`;
  }

  async generateOrderNumber() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const dateString = `${year}${month}${day}`;
    const prefix = `ORD`;
    
    const hash = await this.generateUniqueHash(prefix, dateString);
    
    return `${prefix}-${dateString}-${hash}`;
  }

  async getAllOrders(limit = 50, offset = 0, status = null, customerEmail = null, dateFrom = null, dateTo = null, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for order access');
    }

    let query = this.supabase
      .from('orders')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (customerEmail) {
      query = query.ilike('customer_email', `%${customerEmail}%`);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getOrder(id, merchantId = null) {
    let query = this.supabase
      .from('orders')
      .select('*')
      .eq('id', id);

    // Add merchant isolation if merchantId is provided
    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - order not found or access denied
        return null;
      }
      throw error;
    }
    
    // Get order items for this order
    const { data: items, error: itemsError } = await this.supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);
    
    if (itemsError) throw itemsError;
    
    return {
      ...data,
      items: items || []
    };
  }

  async getOrderStats(dateFrom = null, dateTo = null, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for order stats');
    }

    let query = this.supabase
      .from('orders')
      .select('status, total_amount, created_at')
      .eq('merchant_id', merchantId);

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    const orders = data || [];
    const stats = {
      total_orders: orders.length,
      pending_orders: orders.filter(o => o.status === 'pending').length,
      processing_orders: orders.filter(o => o.status === 'processing').length,
      shipped_orders: orders.filter(o => o.status === 'shipped').length,
      delivered_orders: orders.filter(o => o.status === 'delivered').length,
      cancelled_orders: orders.filter(o => o.status === 'cancelled').length,
      total_revenue: orders.filter(o => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0),
      pending_value: orders.filter(o => o.status === 'pending')
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0),
      total_order_value: orders
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
    };

    return stats;
  }

  async deleteOrder(id, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for order deletion');
    }

    // First delete order items
    await this.supabase
      .from('order_items')
      .delete()
      .eq('order_id', id);

    // Then delete the order (with merchant validation)
    const { data, error } = await this.supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) throw error;
    return { changes: 1, deletedOrder: data };
  }

  async updateOrderStatus(id, status, trackingNumber = null, notes = null, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for order status updates');
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (trackingNumber) {
      updateData.tracking_number = trackingNumber;
    }

    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'shipped') {
      updateData.shipped_date = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_date = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async bulkUpdateOrderStatus(orderIds, status, trackingNumber = null) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { changes: 0 };
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (trackingNumber) {
      updateData.tracking_number = trackingNumber;
    }

    if (status === 'shipped') {
      updateData.shipped_date = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_date = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('orders')
      .update(updateData)
      .in('id', orderIds)
      .select();

    if (error) throw error;
    return { changes: data ? data.length : 0 };
  }

  async bulkDeleteOrders(orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { changes: 0 };
    }

    // First delete order items for all orders
    await this.supabase
      .from('order_items')
      .delete()
      .in('order_id', orderIds);

    // Then delete the orders
    const { data, error } = await this.supabase
      .from('orders')
      .delete()
      .in('id', orderIds)
      .select();

    if (error) throw error;
    return { changes: data ? data.length : 0 };
  }

  // Payment Methods operations
  async getPaymentMethods(merchantId = null) {
    try {
      console.log('💳 Fetching payment methods from database for merchant:', merchantId);
      
      let query = this.supabase
        .from('payment_methods')
        .select('*');

      // Filter by merchant if provided
      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('💥 Error fetching payment methods:', error.message);
        throw error;
      }

      const methods = {};
      if (data && data.length > 0) {
        data.forEach(method => {
          methods[method.method_type] = {
            enabled: method.enabled,
            ...method.config_json
          };
        });
        console.log('✅ Payment methods retrieved for merchant', merchantId, ':', Object.keys(methods));
      } else {
        console.log('📋 No payment methods found in database for merchant:', merchantId);
        // Return default payment methods structure if none found
        methods.bank_transfer = {
          enabled: false,
          bank_name: "",
          account_number: "",
          account_holder_name: "",
          instructions: ""
        };
        methods.xendit = {
          enabled: false,
          environment: "sandbox",
          secret_key: "",
          public_key: "",
          webhook_token: "",
          payment_methods: {
            bank_transfer: true,
            ewallet: true,
            retail_outlet: true,
            credit_card: true
          }
        };
      }

      return methods;
    } catch (error) {
      console.error('💥 getPaymentMethods failed:', error.message);
      throw error;
    }
  }

  async updatePaymentMethods(methods, merchantId = null) {
    try {
      console.log('💳 Updating payment methods in database for merchant', merchantId, ':', methods);
      
      for (const [methodType, config] of Object.entries(methods)) {
        const { enabled, ...configData } = config;
        
        console.log(`💳 Processing ${methodType} for merchant ${merchantId}:`, { enabled, configData });
        
        // Try upsert first
        const { data, error } = await this.supabase
          .from('payment_methods')
          .upsert({
            method_type: methodType,
            enabled: enabled,
            config_json: configData,
            merchant_id: merchantId
          }, {
            onConflict: 'method_type,merchant_id'
          })
          .select();

        if (error) {
          // Check if it's the unique constraint error
          if (error.code === '42P10' || error.message.includes('no unique or exclusion constraint')) {
            console.log(`⚠️  UNIQUE constraint missing for ${methodType}, trying manual upsert...`);
            
            // Fallback: manual upsert logic
            const { data: existing, error: selectError } = await this.supabase
              .from('payment_methods')
              .select('id')
              .eq('method_type', methodType)
              .single();

            if (selectError && selectError.code !== 'PGRST116') {
              console.error(`💥 Failed to check existing ${methodType}:`, selectError.message);
              throw selectError;
            }

            if (existing) {
              // Update existing record
              const { data: updateData, error: updateError } = await this.supabase
                .from('payment_methods')
                .update({
                  enabled: enabled,
                  config_json: configData
                })
                .eq('method_type', methodType)
                .select();

              if (updateError) {
                console.error(`💥 Failed to update existing ${methodType}:`, updateError.message);
                throw updateError;
              }
              console.log(`✅ Updated existing payment method ${methodType}:`, updateData);
            } else {
              // Insert new record
              const { data: insertData, error: insertError } = await this.supabase
                .from('payment_methods')
                .insert({
                  method_type: methodType,
                  enabled: enabled,
                  config_json: configData
                })
                .select();

              if (insertError) {
                console.error(`💥 Failed to insert new ${methodType}:`, insertError.message);
                throw insertError;
              }
              console.log(`✅ Inserted new payment method ${methodType}:`, insertData);
            }
          } else {
            console.error(`💥 Failed to update payment method ${methodType}:`, error.message);
            throw error;
          }
        } else {
          console.log(`✅ Updated payment method ${methodType}:`, data);
        }
      }

      const result = await this.getPaymentMethods();
      console.log('✅ Payment methods update completed:', result);
      return result;
    } catch (error) {
      console.error('💥 updatePaymentMethods failed:', error.message);
      console.error('🔧 Possible fixes:');
      console.error('  1. Run the database migration script: scripts/fix-database-schema-issues.sql');
      console.error('  2. Or add UNIQUE constraint: ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_method_type_unique UNIQUE (method_type);');
      throw error;
    }
  }

  // Access logging
  async logAccess(accessData) {
    const { data, error } = await this.supabase
      .from('access_logs')
      .insert({
        ip_address: accessData.ip,
        user_agent: accessData.userAgent,
        access_type: accessData.type,
        customer_email: accessData.email,
        invoice_id: accessData.invoiceId,
        success: accessData.success
      })
      .select()
      .single();

    if (error) throw error;
    return { lastInsertRowid: data.id };
  }

  // ==========================================
  // MERCHANT USER MANAGEMENT METHODS
  // ==========================================

  /**
   * Create a new merchant user
   */
  async createMerchant(merchantData) {
    // Handle both camelCase and snake_case field names for compatibility
    const insertData = {
      email: merchantData.email.toLowerCase(),
      password_hash: merchantData.passwordHash || merchantData.password_hash || merchantData.password,
      business_name: merchantData.businessName || merchantData.business_name || '',
      full_name: merchantData.fullName || merchantData.full_name || '',
      phone: merchantData.phone || '',
      address: merchantData.address || '',
      website: merchantData.website || '',
      status: merchantData.status || 'active',
      email_verified: merchantData.emailVerified || merchantData.email_verified || false,
      email_verification_token: merchantData.emailVerificationToken || merchantData.email_verification_token || null,
      subscription_plan: merchantData.subscriptionPlan || merchantData.subscription_plan || 'free'
    };

    // Validate required fields
    if (!insertData.password_hash) {
      throw new Error('Password hash is required for merchant creation');
    }

    const { data, error } = await this.supabase
      .from('merchants')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    console.log(`👤 New merchant created: ${data.email} (${data.business_name})`);
    return data;
  }

  /**
   * Get merchant by email
   */
  async getMerchant(email) {
    const { data, error } = await this.supabase
      .from('merchants')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Add field compatibility mapping for AuthService
    if (data) {
      return {
        ...data,
        password: data.password_hash,  // Add compatibility field for AuthService
        businessName: data.business_name,
        fullName: data.full_name,
        emailVerified: data.email_verified,
        emailVerificationToken: data.email_verification_token,
        resetToken: data.reset_token,
        resetTokenExpires: data.reset_token_expires,
        lastLogin: data.last_login,
        loginAttempts: data.login_attempts,
        lockedUntil: data.locked_until,
        subscriptionPlan: data.subscription_plan,
        subscriptionExpires: data.subscription_expires,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }
    
    return data;
  }

  /**
   * Get merchant by ID
   */
  async getMerchantById(id) {
    const { data, error } = await this.supabase
      .from('merchants')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Add field compatibility mapping for AuthService
    if (data) {
      return {
        ...data,
        password: data.password_hash,  // Add compatibility field for AuthService
        businessName: data.business_name,
        fullName: data.full_name,
        emailVerified: data.email_verified,
        emailVerificationToken: data.email_verification_token,
        resetToken: data.reset_token,
        resetTokenExpires: data.reset_token_expires,
        lastLogin: data.last_login,
        loginAttempts: data.login_attempts,
        lockedUntil: data.locked_until,
        subscriptionPlan: data.subscription_plan,
        subscriptionExpires: data.subscription_expires,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }
    
    return data;
  }

  /**
   * Get merchant by email verification token
   */
  async getMerchantByEmailVerificationToken(verificationToken) {
    const { data, error } = await this.supabase
      .from('merchants')
      .select('*')
      .eq('email_verification_token', verificationToken)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Add field compatibility mapping
    if (data) {
      return {
        ...data,
        id: data.id,
        password: data.password_hash,
        businessName: data.business_name,
        fullName: data.full_name,
        emailVerified: data.email_verified,
        emailVerificationToken: data.email_verification_token,
        resetToken: data.reset_token,
        resetTokenExpires: data.reset_token_expires,
        lastLogin: data.last_login,
        loginAttempts: data.login_attempts,
        lockedUntil: data.locked_until,
        subscriptionPlan: data.subscription_plan,
        subscriptionExpires: data.subscription_expires,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    return null;
  }

  /**
   * Get merchant by reset token
   */
  async getMerchantByResetToken(resetToken) {
    const { data, error } = await this.supabase
      .from('merchants')
      .select('*')
      .eq('reset_token', resetToken)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Add field compatibility mapping for AuthService
    if (data) {
      return {
        ...data,
        password: data.password_hash,  // Add compatibility field for AuthService
        businessName: data.business_name,
        fullName: data.full_name,
        emailVerified: data.email_verified,
        emailVerificationToken: data.email_verification_token,
        resetToken: data.reset_token,
        resetTokenExpires: data.reset_token_expires,
        lastLogin: data.last_login,
        loginAttempts: data.login_attempts,
        lockedUntil: data.locked_until,
        subscriptionPlan: data.subscription_plan,
        subscriptionExpires: data.subscription_expires,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }
    
    return data;
  }

  /**
   * Update merchant data
   */
  async updateMerchant(id, updateData) {
    const updateFields = {};
    
    // Handle both camelCase and snake_case field names for compatibility
    if (updateData.email) updateFields.email = updateData.email.toLowerCase();
    
    // Password hash - handle both formats
    const passwordHash = updateData.passwordHash || updateData.password_hash || updateData.password;
    if (passwordHash) updateFields.password_hash = passwordHash;
    
    // Business name - handle both formats
    const businessName = updateData.businessName || updateData.business_name;
    if (businessName !== undefined) updateFields.business_name = businessName;
    
    // Full name - handle both formats
    const fullName = updateData.fullName || updateData.full_name;
    if (fullName !== undefined) updateFields.full_name = fullName;
    
    if (updateData.phone !== undefined) updateFields.phone = updateData.phone;
    if (updateData.address !== undefined) updateFields.address = updateData.address;
    if (updateData.website !== undefined) updateFields.website = updateData.website;
    if (updateData.status) updateFields.status = updateData.status;
    
    // Email verification - handle both formats
    const emailVerified = updateData.emailVerified || updateData.email_verified;
    if (emailVerified !== undefined) updateFields.email_verified = emailVerified;
    
    // Email verification token - handle both formats
    const emailVerificationToken = updateData.emailVerificationToken || updateData.email_verification_token;
    if (emailVerificationToken !== undefined) updateFields.email_verification_token = emailVerificationToken;
    
    // Reset token - handle both formats
    const resetToken = updateData.resetToken || updateData.reset_token;
    if (resetToken !== undefined) updateFields.reset_token = resetToken;
    
    // Reset token expires - handle both formats
    const resetTokenExpires = updateData.resetTokenExpires || updateData.reset_token_expires;
    if (resetTokenExpires) updateFields.reset_token_expires = resetTokenExpires;
    
    // Last login - handle both formats
    const lastLogin = updateData.lastLogin || updateData.last_login;
    if (lastLogin) updateFields.last_login = lastLogin;
    
    // Login attempts - handle both formats
    const loginAttempts = updateData.loginAttempts || updateData.login_attempts;
    if (loginAttempts !== undefined) updateFields.login_attempts = loginAttempts;
    
    // Locked until - handle both formats
    const lockedUntil = updateData.lockedUntil || updateData.locked_until;
    if (lockedUntil) updateFields.locked_until = lockedUntil;
    
    // Subscription plan - handle both formats
    const subscriptionPlan = updateData.subscriptionPlan || updateData.subscription_plan;
    if (subscriptionPlan) updateFields.subscription_plan = subscriptionPlan;
    
    // Subscription expires - handle both formats
    const subscriptionExpires = updateData.subscriptionExpires || updateData.subscription_expires;
    if (subscriptionExpires) updateFields.subscription_expires = subscriptionExpires;
    
    // Deleted at - handle both formats
    const deletedAt = updateData.deletedAt || updateData.deleted_at;
    if (deletedAt) updateFields.deleted_at = deletedAt;

    const { data, error } = await this.supabase
      .from('merchants')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`👤 Merchant updated: ${data.email}`);
    return data;
  }

  /**
   * Delete merchant (soft delete by setting status to inactive)
   */
  async deleteMerchant(id) {
    return this.updateMerchant(id, { 
      status: 'inactive',
      deletedAt: new Date().toISOString()
    });
  }

  /**
   * Get all merchants (admin function)
   */
  async getAllMerchants() {
    const { data, error } = await this.supabase
      .from('merchants')
      .select('*')
      .neq('status', 'inactive')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get merchant statistics
   */
  async getMerchantStats() {
    const { data, error } = await this.supabase
      .from('merchants')
      .select('*');

    if (error) throw error;

    const merchants = data || [];
    const totalMerchants = merchants.length;
    const activeMerchants = merchants.filter(m => m.status === 'active').length;
    const verifiedMerchants = merchants.filter(m => m.email_verified).length;
    
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentLogins = merchants.filter(m => {
      if (!m.last_login) return false;
      return new Date(m.last_login) > lastWeek;
    }).length;

    return {
      totalMerchants,
      activeMerchants,
      verifiedMerchants,
      recentLogins,
      inactiveMerchants: totalMerchants - activeMerchants
    };
  }

  // Account Settings operations (alias for business settings for compatibility)
  async getAccountSettings(merchantId = null) {
    // Account settings are the same as business settings in this system
    return await this.getBusinessSettings(merchantId);
  }

  async updateAccountSettings(settings, merchantId = null) {
    // Account settings are the same as business settings in this system
    return await this.updateBusinessSettings(settings, merchantId);
  }

  // Premium Branding Helper Methods
  async isPremiumActive(merchantId = null) {
    try {
      const businessSettings = await this.getBusinessSettings(merchantId);
      return businessSettings?.premiumActive === true;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  }

  async getPremiumBrandingSettings(merchantId = null) {
    try {
      const businessSettings = await this.getBusinessSettings(merchantId);
      if (!businessSettings?.premiumActive) {
        return null;
      }

      return {
        customHeaderText: businessSettings.customHeaderText,
        customHeaderLogoUrl: businessSettings.customHeaderLogoUrl,
        customFooterLogoUrl: businessSettings.customFooterLogoUrl,
        customHeaderBgColor: businessSettings.customHeaderBgColor || '#311d6b',
        customFooterBgColor: businessSettings.customFooterBgColor || '#311d6b',
        hideAspreeBranding: businessSettings.hideAspreeBranding === true
      };
    } catch (error) {
      console.error('Error fetching premium branding settings:', error);
      return null;
    }
  }

  async activatePremiumBranding(premiumSettings = {}, merchantId = null) {
    try {
      const updateData = {
        premiumActive: true,
        ...premiumSettings
      };

      return await this.updateBusinessSettings(updateData, merchantId);
    } catch (error) {
      console.error('Error activating premium branding:', error);
      throw error;
    }
  }

  async deactivatePremiumBranding(merchantId = null) {
    try {
      return await this.updateBusinessSettings({
        premiumActive: false,
        hideAspreeBranding: false
      }, merchantId);
    } catch (error) {
      console.error('Error deactivating premium branding:', error);
      throw error;
    }
  }

  // Usage Statistics operations
  async getUsageStatistics() {
    // Return basic statistics from various tables
    try {
      const [invoices, customers, products, orders] = await Promise.all([
        this.supabase.from('invoices').select('id, status, grand_total, created_at'),
        this.supabase.from('customers').select('id, created_at'),
        this.supabase.from('products').select('id, is_active'),
        this.supabase.from('orders').select('id, status, total_amount, created_at')
      ]);

      const totalInvoices = invoices.data?.length || 0;
      const totalCustomers = customers.data?.length || 0;
      const totalProducts = products.data?.length || 0;
      const totalOrders = orders.data?.length || 0;

      // Calculate revenue
      const totalRevenue = invoices.data?.reduce((sum, invoice) => {
        return sum + (invoice.status === 'paid' ? parseFloat(invoice.grand_total || 0) : 0);
      }, 0) || 0;

      // Calculate this month's statistics
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const thisMonthInvoices = invoices.data?.filter(inv => 
        new Date(inv.created_at) >= thisMonth
      ).length || 0;

      const thisMonthRevenue = invoices.data?.filter(inv => 
        new Date(inv.created_at) >= thisMonth && inv.status === 'paid'
      ).reduce((sum, inv) => sum + parseFloat(inv.grand_total || 0), 0) || 0;

      return {
        totalInvoices,
        totalCustomers,
        totalProducts,
        totalOrders,
        totalRevenue,
        thisMonthInvoices,
        thisMonthRevenue,
        averageInvoiceValue: totalInvoices > 0 ? totalRevenue / totalInvoices : 0
      };

    } catch (error) {
      console.error('Error getting usage statistics:', error);
      return {
        totalInvoices: 0,
        totalCustomers: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        thisMonthInvoices: 0,
        thisMonthRevenue: 0,
        averageInvoiceValue: 0
      };
    }
  }

  // INVOICE ITEMS NORMALIZATION UTILITY
  // Fix for issue where productName, unitPrice, lineTotal display as ":" instead of actual values
  normalizeInvoiceItems(items_json) {
    try {
      let items = [];
      
      // Handle different data formats
      if (typeof items_json === 'string') {
        items = JSON.parse(items_json);
      } else if (Array.isArray(items_json)) {
        items = items_json;
      } else if (items_json && typeof items_json === 'object') {
        items = [items_json];
      } else {
        console.warn('⚠️ Invalid items_json format:', typeof items_json);
        return [];
      }

      // Normalize each item to ensure consistent field structure
      const normalizedItems = items.map((item, index) => {
        if (!item || typeof item !== 'object') {
          console.warn(`⚠️ Invalid item at index ${index}:`, item);
          return {
            productName: `Product ${index + 1}`,
            quantity: 1,
            unitPrice: 0,
            lineTotal: 0,
            description: '',
            sku: ''
          };
        }

        const normalizedItem = {
          // Handle productName with multiple fallback formats
          productName: item.productName || item.product_name || item.name || item.productname || `Product ${index + 1}`,
          
          // Handle quantity
          quantity: parseInt(item.quantity || item.qty || 1),
          
          // Handle unitPrice with multiple fallback formats
          unitPrice: parseFloat(item.unitPrice || item.unit_price || item.price || item.unitprice || 0),
          
          // Handle lineTotal with multiple fallback formats
          lineTotal: parseFloat(item.lineTotal || item.line_total || item.total || item.linetotal || 0),
          
          // Optional fields
          description: item.description || item.desc || '',
          sku: item.sku || '',
          category: item.category || ''
        };

        // Calculate line total if missing
        if (!normalizedItem.lineTotal || normalizedItem.lineTotal === 0) {
          normalizedItem.lineTotal = normalizedItem.quantity * normalizedItem.unitPrice;
        }

        // Validate normalized values
        if (!normalizedItem.productName || normalizedItem.productName.trim() === '' || normalizedItem.productName === ':') {
          console.warn(`⚠️ Fixed empty/invalid productName for item ${index}:`, item.productName || 'undefined');
          normalizedItem.productName = `Product ${index + 1}`;
        }

        if (normalizedItem.unitPrice < 0 || isNaN(normalizedItem.unitPrice)) {
          console.warn(`⚠️ Fixed invalid unitPrice for item ${index}:`, item.unitPrice || 'undefined');
          normalizedItem.unitPrice = 0;
        }

        if (normalizedItem.quantity <= 0 || isNaN(normalizedItem.quantity)) {
          console.warn(`⚠️ Fixed invalid quantity for item ${index}:`, item.quantity || 'undefined');
          normalizedItem.quantity = 1;
        }

        console.log(`✅ Normalized DB item ${index}:`, {
          productName: normalizedItem.productName,
          quantity: normalizedItem.quantity,
          unitPrice: normalizedItem.unitPrice,
          lineTotal: normalizedItem.lineTotal
        });

        return normalizedItem;
      });

      return normalizedItems;
      
    } catch (error) {
      console.error('❌ Error normalizing invoice items:', error);
      return [];
    }
  }

  async getProductCategories(merchantId = null) {
    try {
      let query = this.supabase
        .from('products')
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null);
      
      // Add merchant filtering if merchantId is provided
      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }
      
      const { data: products, error } = await query;

      if (error) throw error;

      // Count categories
      const categoryCount = {};
      products.forEach(product => {
        const category = product.category;
        if (category) {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        }
      });

      return Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => a.category.localeCompare(b.category));
    } catch (error) {
      console.error('Error fetching product categories:', error);
      return [];
    }
  }

  async getCustomerStats(merchantId = null) {
    try {
      console.log(`📊 Calculating customer stats for merchant: ${merchantId}`);

      // Get customers filtered by merchant
      let customerQuery = this.supabase
        .from('customers')
        .select('*');

      if (merchantId) {
        customerQuery = customerQuery.eq('merchant_id', merchantId);
      }

      const { data: customers, error: customerError } = await customerQuery;
      if (customerError) {
        console.error('❌ Error fetching customers:', customerError);
        throw customerError;
      }

      console.log(`👥 Found ${customers.length} customers for merchant ${merchantId}`);

      // Get invoices filtered by merchant for CLV calculation
      let invoiceQuery = this.supabase
        .from('invoices')
        .select('customer_email, grand_total, created_at');
      
      if (merchantId) {
        invoiceQuery = invoiceQuery.eq('merchant_id', merchantId);
      }

      const { data: invoices, error: invoiceError } = await invoiceQuery;
      if (invoiceError) throw invoiceError;

      // Get orders filtered by merchant
      let orderQuery = this.supabase
        .from('orders')
        .select('customer_email, created_at');
      
      if (merchantId) {
        orderQuery = orderQuery.eq('merchant_id', merchantId);
      }

      const { data: orders, error: orderError } = await orderQuery;
      if (orderError) throw orderError;

      const totalCustomers = customers.length;
      
      // Calculate active customers (with orders or invoices)
      const activeCustomers = customers.filter(c => {
        const hasOrders = orders.some(o => o.customer_email === c.email);
        const hasInvoices = invoices.some(i => i.customer_email === c.email);
        return hasOrders || hasInvoices;
      }).length;

      // Calculate repeat customers (more than 1 order)
      const repeatCustomers = customers.filter(c => {
        const orderCount = orders.filter(o => o.customer_email === c.email).length;
        return orderCount > 1;
      }).length;

      // Calculate new customers this month
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newCustomersThisMonth = customers.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= firstDayThisMonth;
      }).length;

      // Calculate total customer lifetime value from both invoices and orders
      const totalCLV = customers.reduce((sum, customer) => {
        const customerInvoices = invoices.filter(i => i.customer_email === customer.email);
        const customerOrders = orders.filter(o => o.customer_email === customer.email);

        const invoiceTotal = customerInvoices.reduce((invSum, inv) => invSum + (inv.grand_total || 0), 0);
        const orderTotal = customerOrders.reduce((ordSum, ord) => ordSum + (ord.total_amount || 0), 0);
        const customerTotal = invoiceTotal + orderTotal;

        return sum + customerTotal;
      }, 0);

      return {
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        repeat_customers: repeatCustomers,
        new_customers_this_month: newCustomersThisMonth,
        average_clv: totalCustomers > 0 ? totalCLV / totalCustomers : 0,
        total_clv: totalCLV
      };
    } catch (error) {
      console.error('Error fetching customer stats:', error);
      return {
        total_customers: 0,
        active_customers: 0,
        repeat_customers: 0,
        new_customers_this_month: 0,
        average_clv: 0,
        total_clv: 0
      };
    }
  }

  async getCustomerById(customerId, merchantId = null) {
    try {
      let query = this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId);

      // Filter by merchant if provided
      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Customer not found
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching customer by ID:', error);
      throw error;
    }
  }

  async updateCustomer(customerId, customerData, merchantId = null) {
    try {
      let query = this.supabase
        .from('customers')
        .update({
          ...customerData,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId);

      // Filter by merchant if provided
      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }

      const { data, error } = await query.select();

      if (error) throw error;

      return { changes: data ? data.length : 0 };
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async deleteCustomer(customerId, merchantId = null) {
    try {
      let query = this.supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      // Filter by merchant if provided
      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }

      const { data, error } = await query.select();

      if (error) throw error;

      return { changes: data ? data.length : 0 };
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  async exportCustomersToCSV(merchantId = null) {
    try {
      const customers = await this.getAllCustomers(1000, 0, null, merchantId);
      
      const headers = [
        'ID', 'Name', 'Email', 'Phone', 'Address', 
        'Invoice Count', 'Total Spent', 'First Invoice Date', 'Last Invoice Date',
        'Created At', 'Updated At'
      ];

      const csvRows = [headers.join(',')];
      
      customers.forEach(customer => {
        const row = [
          customer.id,
          `"${customer.name || ''}"`,
          `"${customer.email || ''}"`,
          `"${customer.phone || ''}"`,
          `"${customer.address || ''}"`,
          customer.invoice_count || 0,
          customer.total_spent || 0,
          customer.first_invoice_date ? `"${customer.first_invoice_date}"` : '""',
          customer.last_invoice_date ? `"${customer.last_invoice_date}"` : '""',
          customer.created_at ? `"${customer.created_at}"` : '""',
          customer.updated_at ? `"${customer.updated_at}"` : '""'
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    } catch (error) {
      console.error('Error exporting customers to CSV:', error);
      throw error;
    }
  }

  // Payment confirmation methods
  async addPaymentConfirmation(invoiceId, confirmationData) {
    try {
      console.log(`💳 Adding payment confirmation for invoice ${invoiceId}:`, {
        hasFilePath: !!confirmationData.filePath,
        hasNotes: !!confirmationData.notes,
        fileSize: confirmationData.size
      });

      // Update the invoice with payment confirmation data
      const { data, error } = await this.supabase
        .from('invoices')
        .update({
          payment_confirmation_file: confirmationData.filePath,
          payment_confirmation_notes: confirmationData.notes || '',
          payment_confirmation_date: new Date().toISOString(),
          confirmation_status: 'pending',
          payment_status: 'confirmation_pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', parseInt(invoiceId))
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('❌ Invoice not found for payment confirmation:', invoiceId);
          return null;
        }
        throw error;
      }

      console.log(`✅ Payment confirmation added for invoice ${data.invoice_number}`);
      return data;
    } catch (error) {
      console.error('Error adding payment confirmation:', error);
      throw error;
    }
  }

  // Update payment confirmation status (for merchant approval/rejection)
  async updatePaymentConfirmationStatus(invoiceId, status, merchantNotes = '') {
    try {
      console.log(`🔄 Updating payment confirmation status for invoice ${invoiceId}:`, {
        status,
        hasMerchantNotes: !!merchantNotes
      });

      // First get the current invoice to check payment stage
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        console.log('❌ Invoice not found for confirmation status update:', invoiceId);
        return null;
      }

      const updateData = {
        confirmation_status: status,
        merchant_confirmation_notes: merchantNotes,
        confirmation_reviewed_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Update payment status based on confirmation status and payment stage
      if (status === 'approved') {
        const paymentStage = invoice.payment_stage || 'full_payment';
        
        if (paymentStage === 'down_payment') {
          // Down payment confirmed - move to final payment stage
          updateData.payment_status = 'partial';
          updateData.status = 'dp_paid';
          updateData.payment_stage = 'final_payment';
          updateData.dp_confirmed_date = new Date().toISOString();
          console.log(`Down payment confirmed for invoice ${invoice.invoice_number} - moved to final payment stage`);
        } else if (paymentStage === 'final_payment') {
          // Final payment confirmed - complete the invoice
          updateData.payment_status = 'paid';
          updateData.status = 'paid';
          console.log(`Final payment confirmed for invoice ${invoice.invoice_number} - invoice completed`);
        } else {
          // Full payment confirmed
          updateData.payment_status = 'paid';
          updateData.status = 'paid';
          console.log(`Full payment confirmed for invoice ${invoice.invoice_number}`);
        }
      } else if (status === 'rejected') {
        // Payment confirmation rejected - revert to pending payment
        updateData.payment_status = 'pending';
        updateData.status = 'pending';
        console.log(`Payment confirmation rejected for invoice ${invoice.invoice_number}`);
      }

      const { data, error } = await this.supabase
        .from('invoices')
        .update(updateData)
        .eq('id', parseInt(invoiceId))
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      // Auto-create order if payment is fully approved (paid status)
      if (status === 'approved' && data.status === 'paid') {
        try {
          console.log(`💎 Payment fully approved for invoice ${data.invoice_number} - creating order`);
          const orderResult = await this.createOrderFromInvoice(invoiceId, data.merchant_id);
          console.log(`✅ Order ${orderResult.orderNumber} auto-created from invoice ${data.invoice_number}`);

          // Return data with order creation info
          return {
            ...data,
            orderCreated: true,
            orderId: orderResult.lastInsertRowid,
            orderNumber: orderResult.orderNumber
          };
        } catch (orderError) {
          console.error('❌ Failed to auto-create order from approved invoice:', orderError);
          // Still return the updated invoice data even if order creation failed
          return {
            ...data,
            orderCreated: false,
            orderError: orderError.message
          };
        }
      }

      return data;
    } catch (error) {
      console.error('Error updating payment confirmation status:', error);
      throw error;
    }
  }

  // Update payment stage (down_payment -> final_payment -> completed)
  async updatePaymentStage(invoiceId, newStage, newStatus) {
    try {
      console.log(`🔄 Updating payment stage for invoice ${invoiceId}:`, { newStage, newStatus });

      const { data, error } = await this.supabase
        .from('invoices')
        .update({
          payment_stage: newStage,
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', parseInt(invoiceId))
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating payment stage:', error);
      throw error;
    }
  }

  // Missing functions for compatibility
  async getSubscriptionInfo() {
    // Return a default subscription status for premium features
    return {
      plan: 'free',
      features: {
        branding: false,
        advancedAnalytics: false,
        unlimitedInvoices: false
      },
      status: 'active'
    };
  }

  async createBackup() {
    // For Supabase, we don't need manual backup as it's handled by the platform
    console.log('📋 Backup functionality not needed with Supabase - data is automatically backed up');
    return {
      success: true,
      message: 'Supabase handles automatic backups'
    };
  }

  async resetAccountData(merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for account reset');
    }

    try {
      // Delete merchant-specific data in reverse dependency order
      await this.supabase.from('access_logs').delete().eq('merchant_id', merchantId);
      await this.supabase.from('orders').delete().eq('merchant_id', merchantId);
      await this.supabase.from('invoices').delete().eq('merchant_id', merchantId);
      await this.supabase.from('products').delete().eq('merchant_id', merchantId);
      await this.supabase.from('customers').delete().eq('merchant_id', merchantId);
      await this.supabase.from('business_settings').delete().eq('merchant_id', merchantId);

      console.log(`✅ Account data reset completed for merchant ${merchantId}`);
      return { success: true };
    } catch (error) {
      console.error('Error resetting account data:', error);
      throw error;
    }
  }

  async searchCustomers(query, merchantId) {
    if (!merchantId) {
      throw new Error('Merchant ID is required for customer search');
    }

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('merchant_id', merchantId)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  close() {
    // No-op for compatibility
  }
}

export default SupabaseDatabase;
