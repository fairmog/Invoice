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
  async createProduct(productData) {
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
        image_url: productData.image_url || ''
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

  async getAllProducts(limit = 50, offset = 0, category = null, active_only = true) {
    let query = this.supabase
      .from('products')
      .select('*');

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

  async searchProducts(searchTerm, category = null, priceMin = null, priceMax = null, active_only = true, limit = 50, offset = 0) {
    let query = this.supabase
      .from('products')
      .select('*');

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

  async updateProduct(id, productData) {
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
      .select();

    if (error) throw error;
    return { changes: data ? data.length : 0 };
  }

  async deleteProduct(id) {
    const { data, error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;
    return { changes: data ? data.length : 0 };
  }

  // Customer operations
  async saveCustomer(customerData) {
    try {
      console.log('👤 Saving customer:', {
        name: customerData.name,
        email: customerData.email,
        hasPhone: !!customerData.phone
      });

      if (!customerData.email || !customerData.name) {
        throw new Error('Customer email and name are required');
      }

      const { data: existing, error: selectError } = await this.supabase
        .from('customers')
        .select('*')
        .eq('email', customerData.email)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('💥 Error checking existing customer:', selectError.message);
        throw selectError;
      }

      if (existing) {
        // Update existing customer
        console.log('🔄 Updating existing customer with ID:', existing.id);
        const { data, error } = await this.supabase
          .from('customers')
          .update({
            name: customerData.name,
            phone: customerData.phone || existing.phone,
            address: customerData.address || existing.address,
            last_invoice_date: new Date().toISOString(),
            invoice_count: (existing.invoice_count || 0) + 1
          })
          .eq('email', customerData.email)
          .select()
          .single();

        if (error) {
          console.error('💥 Error updating customer:', error.message);
          throw error;
        }
        console.log('✅ Customer updated successfully');
        return { lastInsertRowid: data.id };
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
          extraction_method: customerData.extraction_method || 'manual'
        })
        .select()
        .single();

        if (error) {
          console.error('💥 Error creating customer:', error.message);
          throw error;
        }
        console.log('✅ Customer created successfully');
        return { lastInsertRowid: data.id };
      }
    } catch (error) {
      console.error('💥 saveCustomer failed:', error.message);
      throw error;
    }
  }

  async getCustomer(email) {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findOrCreateCustomer(customerData) {
    const { name, email, phone } = customerData;
    
    // Try email match first
    if (email) {
      const { data: emailMatch } = await this.supabase
        .from('customers')
        .select('*')
        .ilike('email', email)
        .single();
      
      if (emailMatch) {
        console.log(`✅ Customer matched by email: ${emailMatch.name}`);
        return emailMatch;
      }
    }
    
    // Try phone match
    if (phone) {
      const normalizedPhone = this.normalizePhone(phone);
      const { data: customers } = await this.supabase
        .from('customers')
        .select('*');
      
      const phoneMatch = customers?.find(c => 
        c.phone && this.normalizePhone(c.phone) === normalizedPhone
      );
      
      if (phoneMatch) {
        console.log(`✅ Customer matched by phone: ${phoneMatch.name}`);
        return phoneMatch;
      }
    }
    
    // Create new customer
    console.log(`➕ Creating new customer: ${name || 'Unknown'}`);
    const result = await this.saveCustomer(customerData);
    const { data: newCustomer } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', result.lastInsertRowid)
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

  async getAllCustomers(limit = 50, offset = 0) {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  // Invoice operations
  async saveInvoice(invoiceData) {
    try {
      console.log('💾 Saving invoice to database:', {
        hasInvoice: !!(invoiceData.invoice || invoiceData),
        hasCustomer: !!(invoiceData.invoice?.customer || invoiceData.customer),
        hasItems: !!(invoiceData.invoice?.items || invoiceData.items)
      });
      
      const customerToken = this.generateCustomerToken();
      const invoice = invoiceData.invoice || invoiceData;
      const invoiceNumber = await this.generateInvoiceNumber();
      
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
        });
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
        due_date: invoice.header?.dueDate || new Date().toISOString().split('T')[0],
        original_due_date: invoice.header?.dueDate || new Date().toISOString().split('T')[0],
        status: 'draft',
        payment_stage: invoice.paymentSchedule ? 'down_payment' : 'full_payment',
        payment_status: 'pending',
        subtotal: parseFloat(invoice.calculations?.subtotal || invoice.summary?.subtotal || 0),
        tax_amount: parseFloat(invoice.calculations?.totalTax || invoice.summary?.tax_amount || 0),
        shipping_cost: parseFloat(invoice.calculations?.shippingCost || invoice.summary?.shipping_cost || 0),
        discount: parseFloat(invoice.calculations?.discount || invoice.summary?.discount || 0),
        discount_amount: parseFloat(invoice.calculations?.discount || invoice.summary?.discount || 0),
        grand_total: parseFloat(invoice.calculations?.grandTotal || invoice.summary?.grand_total || 0),
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
        customer_token: customerToken
      };
      
      console.log('📋 Inserting invoice data:', {
        invoice_number: invoiceNumber,
        customer_name: invoiceInsertData.customer_name,
        merchant_name: invoiceInsertData.merchant_name,
        grand_total: invoiceInsertData.grand_total,
        itemsCount: Array.isArray(invoiceInsertData.items_json) ? invoiceInsertData.items_json.length : 0
      });
      
      const { data, error } = await this.supabase
        .from('invoices')
        .insert(invoiceInsertData)
        .select()
        .single();

      if (error) {
        console.error('💥 Invoice insert error:', error.message, error.details);
        throw error;
      }

      console.log('✅ Invoice saved successfully:', {
        id: data.id,
        invoice_number: data.invoice_number,
        grand_total: data.grand_total
      });

      return {
        ...data,
        invoiceNumber: invoiceNumber,
        customerToken
      };
    } catch (error) {
      console.error('💥 saveInvoice failed:', error.message);
      throw error;
    }
  }

  async getAllInvoices(limit = 50, offset = 0, status = null, customerEmail = null, dateFrom = null, dateTo = null) {
    let query = this.supabase
      .from('invoices')
      .select('*');

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

  async getInvoice(id) {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

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

  async updateInvoiceStatus(invoiceId, status) {
    const updateData = { 
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    } else if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw error;

    // Auto-create order if paid
    if (status === 'paid') {
      try {
        const orderResult = await this.createOrderFromInvoice(invoiceId);
        return {
          ...data,
          orderCreated: true,
          orderId: orderResult.lastInsertRowid,
          orderNumber: orderResult.orderNumber
        };
      } catch (error) {
        console.error('Failed to auto-create order from invoice:', error);
      }
    }

    return { changes: 1 };
  }

  async deleteInvoice(id) {
    const { data, error } = await this.supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { changes: 1, deletedInvoice: data };
  }

  async getInvoiceStats(dateFrom = null, dateTo = null) {
    let query = this.supabase
      .from('invoices')
      .select('status, grand_total, created_at');

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
      totalInvoices: invoices.length,
      draftInvoices: invoices.filter(i => i.status === 'draft').length,
      sentInvoices: invoices.filter(i => i.status === 'sent').length,
      paidInvoices: invoices.filter(i => i.status === 'paid').length,
      cancelledInvoices: invoices.filter(i => i.status === 'cancelled').length,
      totalRevenue: invoices.filter(i => i.status === 'paid')
        .reduce((sum, invoice) => sum + parseFloat(invoice.grand_total || 0), 0),
      outstandingAmount: invoices.filter(i => i.status === 'sent')
        .reduce((sum, invoice) => sum + parseFloat(invoice.grand_total || 0), 0),
      draftAmount: invoices.filter(i => i.status === 'draft')
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
  async getBusinessSettings() {
    try {
      const { data, error } = await this.supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .single();

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
          logoUrl: data.logo_url,
          logoPublicId: data.logo_public_id,
          logoFilename: data.logo_filename,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
      
      return {};
    } catch (error) {
      console.error('💥 getBusinessSettings failed:', error.message);
      throw error;
    }
  }

  async updateBusinessSettings(settings) {
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
      // Note: terms_conditions column may not exist in all database instances
      // Skip this field to avoid schema cache errors for now
      // if (settings.termsAndConditions !== undefined || settings.terms_conditions !== undefined) {
      //   mappedSettings.terms_conditions = settings.termsAndConditions || settings.terms_conditions;
      // }
      if (settings.logoUrl !== undefined || settings.logo_url !== undefined) {
        mappedSettings.logo_url = settings.logoUrl || settings.logo_url || null;
      }
      if (settings.logoPublicId !== undefined || settings.logo_public_id !== undefined) {
        mappedSettings.logo_public_id = settings.logoPublicId || settings.logo_public_id || null;
      }
      if (settings.logoFilename !== undefined || settings.logo_filename !== undefined) {
        mappedSettings.logo_filename = settings.logoFilename || settings.logo_filename || null;
      }

      console.log('📋 Mapped settings for database:', mappedSettings);

      // Check if business settings exist
      const { data: existing, error: selectError } = await this.supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .single();

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
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Order operations
  async createOrder(orderData) {
    const orderNumber = await this.generateOrderNumber();
    
    // Auto-create/update customer record
    await this.saveCustomer({
      name: orderData.customer_name,
      email: orderData.customer_email,
      phone: orderData.customer_phone,
      address: orderData.shipping_address || orderData.billing_address
    });
    
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
        source_invoice_number: orderData.source_invoice_number || null
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

  async createOrderFromInvoice(invoiceId) {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Check if order already exists
    const { data: existingOrder } = await this.supabase
      .from('orders')
      .select('*')
      .eq('source_invoice_id', invoiceId)
      .single();
    
    if (existingOrder) {
      console.log(`Order ${existingOrder.order_number} already exists for invoice ${invoice.invoice_number}`);
      return existingOrder;
    }

    const invoiceItems = Array.isArray(invoice.items_json) ? invoice.items_json : [];
    
    const orderData = {
      customer_name: invoice.customer_name,
      customer_email: invoice.customer_email,
      customer_phone: invoice.customer_phone,
      shipping_address: invoice.customer_address,
      billing_address: invoice.customer_address,
      status: 'pending',
      payment_status: 'paid',
      order_date: new Date().toISOString(),
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      shipping_cost: invoice.shipping_cost || 0,
      discount: invoice.discount || 0,
      total_amount: invoice.grand_total,
      notes: `Auto-created from paid invoice ${invoice.invoice_number}`,
      source_invoice_id: invoice.id,
      source_invoice_number: invoice.invoice_number,
      items: invoiceItems.map(item => ({
        product_name: item.productName || item.name,
        sku: item.sku || '',
        quantity: item.quantity,
        unit_price: item.unitPrice || item.price,
        line_total: item.lineTotal || (item.quantity * (item.unitPrice || item.price))
      }))
    };

    const result = await this.createOrder(orderData);
    
    // Update invoice metadata
    const metadata = invoice.metadata_json || {};
    metadata.auto_created_order_id = result.lastInsertRowid;
    metadata.auto_created_order_number = result.orderNumber;
    
    await this.supabase
      .from('invoices')
      .update({ metadata_json: metadata })
      .eq('id', invoiceId);

    console.log(`Order ${result.orderNumber} auto-created from invoice ${invoice.invoice_number}`);
    return result;
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

  async getAllOrders(limit = 50, offset = 0, status = null, customerEmail = null, dateFrom = null, dateTo = null) {
    let query = this.supabase
      .from('orders')
      .select('*')
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

  async getOrder(id) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getOrderStats(dateFrom = null, dateTo = null) {
    let query = this.supabase
      .from('orders')
      .select('status, total_amount, created_at');

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
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      processingOrders: orders.filter(o => o.status === 'processing').length,
      shippedOrders: orders.filter(o => o.status === 'shipped').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
      totalRevenue: orders.filter(o => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0),
      pendingValue: orders.filter(o => o.status === 'pending')
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
    };

    return stats;
  }

  async deleteOrder(id) {
    // First delete order items
    await this.supabase
      .from('order_items')
      .delete()
      .eq('order_id', id);

    // Then delete the order
    const { data, error } = await this.supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { changes: 1, deletedOrder: data };
  }

  async updateOrderStatus(id, status, trackingNumber = null, notes = null) {
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
  async getPaymentMethods() {
    try {
      console.log('💳 Fetching payment methods from database...');
      
      const { data, error } = await this.supabase
        .from('payment_methods')
        .select('*');

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
        console.log('✅ Payment methods retrieved:', Object.keys(methods));
      } else {
        console.log('📋 No payment methods found in database');
      }

      return methods;
    } catch (error) {
      console.error('💥 getPaymentMethods failed:', error.message);
      throw error;
    }
  }

  async updatePaymentMethods(methods) {
    try {
      console.log('💳 Updating payment methods in database:', methods);
      
      for (const [methodType, config] of Object.entries(methods)) {
        const { enabled, ...configData } = config;
        
        console.log(`💳 Processing ${methodType}:`, { enabled, configData });
        
        // Try upsert first
        const { data, error } = await this.supabase
          .from('payment_methods')
          .upsert({
            method_type: methodType,
            enabled: enabled,
            config_json: configData
          }, {
            onConflict: 'method_type'
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
  async getAccountSettings() {
    // Account settings are the same as business settings in this system
    return await this.getBusinessSettings();
  }

  async updateAccountSettings(settings) {
    // Account settings are the same as business settings in this system
    return await this.updateBusinessSettings(settings);
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

  async getProductCategories() {
    try {
      const { data: products, error } = await this.supabase
        .from('products')
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null);

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

  async getCustomerStats() {
    try {
      // Get all customers
      const { data: customers, error: customerError } = await this.supabase
        .from('customers')
        .select('*');
      
      if (customerError) throw customerError;

      // Get all invoices for CLV calculation
      const { data: invoices, error: invoiceError } = await this.supabase
        .from('invoices')
        .select('customer_email, grand_total, created_at');
      
      if (invoiceError) throw invoiceError;

      // Get all orders
      const { data: orders, error: orderError } = await this.supabase
        .from('orders')
        .select('customer_email, created_at');
      
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

      // Calculate total customer lifetime value
      const totalCLV = customers.reduce((sum, customer) => {
        const customerInvoices = invoices.filter(i => i.customer_email === customer.email);
        const customerTotal = customerInvoices.reduce((invSum, inv) => invSum + (inv.grand_total || 0), 0);
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

  close() {
    // No-op for compatibility
  }
}

export default SupabaseDatabase;
