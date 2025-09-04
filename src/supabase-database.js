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
    const { data: existing } = await this.supabase
      .from('customers')
      .select('*')
      .eq('email', customerData.email)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await this.supabase
        .from('customers')
        .update(customerData)
        .eq('email', customerData.email)
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
    } else {
      // Create new
      const { data, error } = await this.supabase
        .from('customers')
        .insert({
          name: customerData.name || '',
          email: customerData.email || null,
          phone: customerData.phone || null,
          address: customerData.address || null,
          source_invoice_id: customerData.source_invoice_id || null,
          source_invoice_number: customerData.source_invoice_number || null,
          first_invoice_date: customerData.first_invoice_date || new Date().toISOString(),
          last_invoice_date: customerData.last_invoice_date || new Date().toISOString(),
          invoice_count: customerData.invoice_count || 0,
          total_spent: customerData.total_spent || 0,
          extraction_method: customerData.extraction_method || 'manual'
        })
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
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

  // Invoice operations
  async saveInvoice(invoiceData) {
    const customerToken = this.generateCustomerToken();
    const invoice = invoiceData.invoice || invoiceData;
    const invoiceNumber = await this.generateInvoiceNumber();
    
    // Auto-create/update customer record
    await this.saveCustomer({
      name: invoice.customer.name,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      address: invoice.customer.address
    });
    
    const { data, error } = await this.supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_name: invoice.customer.name,
        customer_email: invoice.customer.email,
        customer_phone: invoice.customer.phone,
        customer_address: invoice.customer.address,
        merchant_name: invoice.merchant?.businessName || invoice.businessProfile?.name || 'Unknown',
        merchant_address: invoice.merchant?.address || invoice.businessProfile?.address || '',
        merchant_phone: invoice.merchant?.phone || invoice.businessProfile?.phone || '',
        merchant_email: invoice.merchant?.email || invoice.businessProfile?.email || '',
        invoice_date: invoice.header.invoiceDate,
        due_date: invoice.header.dueDate,
        original_due_date: invoice.header.dueDate,
        status: 'draft',
        payment_stage: invoice.paymentSchedule ? 'down_payment' : 'full_payment',
        payment_status: 'pending',
        subtotal: invoice.calculations?.subtotal || invoice.summary?.subtotal || 0,
        tax_amount: invoice.calculations?.totalTax || invoice.summary?.tax_amount || 0,
        shipping_cost: invoice.calculations?.shippingCost || invoice.summary?.shipping_cost || 0,
        discount: invoice.calculations?.discount || invoice.summary?.discount || 0,
        discount_amount: invoice.calculations?.discount || invoice.summary?.discount || 0,
        grand_total: invoice.calculations?.grandTotal || invoice.summary?.grand_total || 0,
        currency: invoice.calculations?.currency || invoice.summary?.currency || 'IDR',
        payment_terms: invoice.payment?.paymentTerms || 'Net 30',
        notes: invoice.notes?.publicNotes || '',
        items_json: invoice.items,
        metadata_json: {
          ...invoice.metadata,
          businessProfile: invoiceData.businessProfile || invoice.businessProfile || null
        },
        payment_schedule_json: invoice.paymentSchedule || null,
        notes_json: invoice.notes || {},
        calculations_json: invoice.calculations || {},
        customer_token: customerToken
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      invoiceNumber: invoiceNumber,
      customerToken
    };
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
    return data || [];
  }

  async getInvoice(id) {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getInvoiceByNumber(invoiceNumber) {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getInvoiceByCustomerToken(token) {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('customer_token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
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

  // Business Settings operations
  async getBusinessSettings() {
    const { data, error } = await this.supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || {};
  }

  async updateBusinessSettings(settings) {
    const { data: existing } = await this.supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await this.supabase
        .from('business_settings')
        .update(settings)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('business_settings')
        .insert(settings)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
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

  // Payment Methods operations
  async getPaymentMethods() {
    const { data, error } = await this.supabase
      .from('payment_methods')
      .select('*');

    if (error) throw error;

    const methods = {};
    data?.forEach(method => {
      methods[method.method_type] = {
        enabled: method.enabled,
        ...method.config_json
      };
    });

    return methods;
  }

  async updatePaymentMethods(methods) {
    for (const [methodType, config] of Object.entries(methods)) {
      const { enabled, ...configData } = config;
      
      const { error } = await this.supabase
        .from('payment_methods')
        .upsert({
          method_type: methodType,
          enabled: enabled,
          config_json: configData
        }, {
          onConflict: 'method_type'
        });

      if (error) throw error;
    }

    return await this.getPaymentMethods();
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
    const { data, error } = await this.supabase
      .from('merchants')
      .insert({
        email: merchantData.email.toLowerCase(),
        password_hash: merchantData.passwordHash,
        business_name: merchantData.businessName || '',
        full_name: merchantData.fullName || '',
        phone: merchantData.phone || '',
        address: merchantData.address || '',
        website: merchantData.website || '',
        status: merchantData.status || 'active',
        email_verified: merchantData.emailVerified || false,
        email_verification_token: merchantData.emailVerificationToken || null,
        subscription_plan: merchantData.subscriptionPlan || 'free'
      })
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
    return data;
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
    return data;
  }

  /**
   * Update merchant data
   */
  async updateMerchant(id, updateData) {
    const updateFields = {};
    
    // Map the fields correctly
    if (updateData.email) updateFields.email = updateData.email.toLowerCase();
    if (updateData.passwordHash) updateFields.password_hash = updateData.passwordHash;
    if (updateData.businessName !== undefined) updateFields.business_name = updateData.businessName;
    if (updateData.fullName !== undefined) updateFields.full_name = updateData.fullName;
    if (updateData.phone !== undefined) updateFields.phone = updateData.phone;
    if (updateData.address !== undefined) updateFields.address = updateData.address;
    if (updateData.website !== undefined) updateFields.website = updateData.website;
    if (updateData.status) updateFields.status = updateData.status;
    if (updateData.emailVerified !== undefined) updateFields.email_verified = updateData.emailVerified;
    if (updateData.emailVerificationToken !== undefined) updateFields.email_verification_token = updateData.emailVerificationToken;
    if (updateData.resetToken !== undefined) updateFields.reset_token = updateData.resetToken;
    if (updateData.resetTokenExpires) updateFields.reset_token_expires = updateData.resetTokenExpires;
    if (updateData.lastLogin) updateFields.last_login = updateData.lastLogin;
    if (updateData.loginAttempts !== undefined) updateFields.login_attempts = updateData.loginAttempts;
    if (updateData.lockedUntil) updateFields.locked_until = updateData.lockedUntil;
    if (updateData.subscriptionPlan) updateFields.subscription_plan = updateData.subscriptionPlan;
    if (updateData.subscriptionExpires) updateFields.subscription_expires = updateData.subscriptionExpires;
    if (updateData.deletedAt) updateFields.deleted_at = updateData.deletedAt;

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

  close() {
    // No-op for compatibility
  }
}

export default SupabaseDatabase;
