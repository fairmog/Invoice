import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cryptoHelper from '../utils/crypto-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SimpleDatabase {
  constructor() {
    this.dataFile = path.join(__dirname, '..', 'database.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const content = fs.readFileSync(this.dataFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading database:', error);
    }
    
    return {
      invoices: [],
      customers: [],
      products: [],
      invoice_items: [],
      orders: [],
      order_items: [],
      access_logs: [],
      business_settings: {
        name: '',
        email: '',
        address: '',
        phone: '',
        website: '',
        taxId: '',
        taxEnabled: false,
        taxRate: 0,
        taxName: 'PPN',
        taxDescription: '',
        hideBusinessName: false, // Hide business name in invoices (useful when logo contains company name)
        businessCode: '', // 3-character code for invoice/order numbering (e.g., 'BEV' for Bevelient)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      payment_methods: {
        bankTransfer: {
          enabled: false,
          bankName: '',
          accountNumber: '',
          accountHolderName: '',
          bankBranch: '',
          instructions: ''
        },
        xendit: {
          enabled: false,
          environment: 'sandbox',
          secretKey: null, // Will be encrypted
          publicKey: '',
          webhookToken: null, // Will be encrypted
          paymentMethods: {
            bankTransfer: true,
            ewallet: true,
            retailOutlet: true,
            creditCard: true
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      },
      lastId: { invoices: 0, customers: 0, products: 0, invoice_items: 0, orders: 0, order_items: 0, access_logs: 0, merchants: 0 }
    };
  }

  saveData() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  generateId(table) {
    this.data.lastId[table]++;
    return this.data.lastId[table];
  }

  // Product CRUD operations
  async createProduct(productData) {
    const id = this.generateId('products');
    const product = {
      id,
      sku: productData.sku,
      name: productData.name,
      description: productData.description || '',
      category: productData.category || '',
      unit_price: productData.unit_price,
      cost_price: productData.cost_price || 0,
      stock_quantity: productData.stock_quantity || 0,
      min_stock_level: productData.min_stock_level || 0,
      is_active: productData.is_active !== undefined ? productData.is_active : 1,
      tax_rate: productData.tax_rate || 0,
      dimensions: productData.dimensions || '',
      weight: productData.weight || null,
      image_url: productData.image_url || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check for duplicate SKU
    const existing = this.data.products.find(p => p.sku === product.sku);
    if (existing) {
      throw new Error('UNIQUE constraint failed: products.sku');
    }

    this.data.products.push(product);
    this.saveData();
    
    return { lastInsertRowid: id };
  }

  async getProduct(id) {
    return this.data.products.find(p => p.id === parseInt(id)) || null;
  }

  async getProductBySku(sku) {
    return this.data.products.find(p => p.sku === sku) || null;
  }

  async getAllProducts(limit = 50, offset = 0, category = null, active_only = true) {
    let products = [...this.data.products];

    if (active_only) {
      products = products.filter(p => p.is_active);
    }

    if (category) {
      products = products.filter(p => p.category === category);
    }

    // Sort by created_at DESC
    products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply pagination
    return products.slice(offset, offset + limit);
  }

  async searchProducts(searchTerm, category = null, priceMin = null, priceMax = null, active_only = true, limit = 50, offset = 0) {
    let products = [...this.data.products];

    // Apply active filter
    if (active_only) {
      products = products.filter(p => p.is_active);
    }

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      products = products.filter(p => 
        p.name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
      );
    }

    // Apply category filter
    if (category) {
      products = products.filter(p => p.category === category);
    }

    // Apply price filters
    if (priceMin !== null) {
      products = products.filter(p => p.unit_price >= priceMin);
    }
    if (priceMax !== null) {
      products = products.filter(p => p.unit_price <= priceMax);
    }

    // Sort by relevance and created date
    products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = products.length;
    const paginatedProducts = products.slice(offset, offset + limit);

    return {
      products: paginatedProducts,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateProduct(id, productData) {
    const index = this.data.products.findIndex(p => p.id === parseInt(id));
    if (index === -1) {
      return { changes: 0 };
    }

    const product = this.data.products[index];
    this.data.products[index] = {
      ...product,
      name: productData.name,
      description: productData.description || '',
      category: productData.category || '',
      unit_price: productData.unit_price,
      cost_price: productData.cost_price || 0,
      stock_quantity: productData.stock_quantity || 0,
      min_stock_level: productData.min_stock_level || 0,
      is_active: productData.is_active !== undefined ? productData.is_active : 1,
      tax_rate: productData.tax_rate || 0,
      dimensions: productData.dimensions || '',
      weight: productData.weight || null,
      image_url: productData.image_url || '',
      updated_at: new Date().toISOString()
    };

    this.saveData();
    return { changes: 1 };
  }

  async deleteProduct(id) {
    const index = this.data.products.findIndex(p => p.id === parseInt(id));
    if (index === -1) {
      return { changes: 0 };
    }

    this.data.products.splice(index, 1);
    this.saveData();
    return { changes: 1 };
  }

  async getProductCategories() {
    const categories = {};
    
    this.data.products
      .filter(p => p.is_active && p.category)
      .forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + 1;
      });

    return Object.entries(categories)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  async getLowStockProducts() {
    return this.data.products
      .filter(p => p.is_active && p.stock_quantity <= p.min_stock_level)
      .sort((a, b) => a.stock_quantity - b.stock_quantity);
  }

  async updateProductStock(id, quantity, operation = 'set') {
    const index = this.data.products.findIndex(p => p.id === parseInt(id));
    if (index === -1) {
      return { changes: 0 };
    }

    const product = this.data.products[index];
    
    if (operation === 'add') {
      product.stock_quantity += quantity;
    } else if (operation === 'subtract') {
      product.stock_quantity -= quantity;
    } else {
      product.stock_quantity = quantity;
    }

    product.updated_at = new Date().toISOString();
    this.saveData();
    return { changes: 1 };
  }

  // Customer operations
  async saveCustomer(customerData) {
    const existing = this.data.customers.find(c => c.email === customerData.email);
    if (existing) {
      // Update existing
      Object.assign(existing, customerData, { updated_at: new Date().toISOString() });
    } else {
      // Create new
      const id = this.generateId('customers');
      const newCustomer = {
        id,
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
        extraction_method: customerData.extraction_method || 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.customers.push(newCustomer);
    }
    this.saveData();
    return { lastInsertRowid: this.data.lastId.customers };
  }

  async getCustomer(email) {
    return this.data.customers.find(c => c.email === email) || null;
  }

  // Enhanced customer matching with hierarchy: email → phone → name
  async findOrCreateCustomer(customerData) {
    const { name, email, phone } = customerData;
    
    // 1. Try exact email match first (highest priority)
    if (email) {
      const emailMatch = this.data.customers.find(c => 
        c.email && c.email.toLowerCase() === email.toLowerCase()
      );
      if (emailMatch) {
        console.log(`✅ Customer matched by email: ${emailMatch.name}`);
        // Update with new information
        if (name && !emailMatch.name) emailMatch.name = name;
        if (phone && !emailMatch.phone) emailMatch.phone = phone;
        emailMatch.updated_at = new Date().toISOString();
        this.saveData();
        return emailMatch;
      }
    }
    
    // 2. Try phone match (second priority)
    if (phone) {
      const normalizedPhone = this.normalizePhone(phone);
      const phoneMatch = this.data.customers.find(c => 
        c.phone && this.normalizePhone(c.phone) === normalizedPhone
      );
      if (phoneMatch) {
        console.log(`✅ Customer matched by phone: ${phoneMatch.name}`);
        // Update with new information
        if (name && !phoneMatch.name) phoneMatch.name = name;
        if (email && !phoneMatch.email) phoneMatch.email = email;
        phoneMatch.updated_at = new Date().toISOString();
        this.saveData();
        return phoneMatch;
      }
    }
    
    // 3. Try fuzzy name match (lowest priority, only if name exists)
    if (name && name.length > 3) {
      const nameMatch = this.findFuzzyNameMatch(name);
      if (nameMatch) {
        console.log(`✅ Customer matched by fuzzy name: ${nameMatch.name} → ${name}`);
        // Update with new information
        if (email && !nameMatch.email) nameMatch.email = email;
        if (phone && !nameMatch.phone) nameMatch.phone = phone;
        nameMatch.updated_at = new Date().toISOString();
        this.saveData();
        return nameMatch;
      }
    }
    
    // 4. No match found, create new customer
    console.log(`➕ Creating new customer: ${name || 'Unknown'}`);
    const result = await this.saveCustomer(customerData);
    // Return the newly created customer
    return this.data.customers.find(c => c.id === this.data.lastId.customers);
  }
  
  // Normalize phone numbers for matching
  normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-digits and handle common Indonesian prefixes
    const digits = phone.replace(/\D/g, '');
    
    // Convert common Indonesian formats to standard
    if (digits.startsWith('08')) return '628' + digits.substring(2); // 08xxx → 628xxx
    if (digits.startsWith('8') && digits.length >= 10) return '62' + digits; // 8xxx → 628xxx
    if (digits.startsWith('628')) return digits; // Already normalized
    if (digits.startsWith('62')) return digits; // International format
    
    return digits;
  }
  
  // Fuzzy name matching for typos
  findFuzzyNameMatch(targetName) {
    if (!targetName || targetName.length < 3) return null;
    
    const target = targetName.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0.8; // Minimum similarity threshold
    
    for (const customer of this.data.customers) {
      if (!customer.name) continue;
      
      const existing = customer.name.toLowerCase().trim();
      const similarity = this.calculateStringSimilarity(target, existing);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = customer;
      }
    }
    
    return bestMatch;
  }
  
  // Calculate string similarity using Levenshtein distance
  calculateStringSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - (distance / maxLen);
  }

  async getAllCustomers(limit = 50, offset = 0, searchTerm = null) {
    let customers = [...this.data.customers];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      customers = customers.filter(c => 
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term)
      );
    }

    // Sort by last updated
    customers.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    // Add customer statistics
    customers = customers.map(customer => {
      const customerInvoices = this.data.invoices.filter(i => i.customer_email === customer.email);
      const customerOrders = this.data.orders.filter(o => o.customer_email === customer.email);
      
      const totalSpent = customerInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
      const totalOrders = customerOrders.length;
      const lastOrderDate = customerOrders.length > 0 ? 
        customerOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))[0].order_date : null;

      return {
        ...customer,
        total_spent: totalSpent,
        total_orders: totalOrders,
        total_invoices: customerInvoices.length,
        last_order_date: lastOrderDate,
        status: totalOrders > 0 ? 'active' : 'inactive'
      };
    });

    return customers.slice(offset, offset + limit);
  }

  async searchCustomers(searchTerm, status = null, limit = 50, offset = 0) {
    let customers = [...this.data.customers];

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      customers = customers.filter(c => 
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.address?.toLowerCase().includes(term)
      );
    }

    // Add customer statistics and apply status filter
    customers = customers.map(customer => {
      const customerInvoices = this.data.invoices.filter(i => i.customer_email === customer.email);
      const customerOrders = this.data.orders.filter(o => o.customer_email === customer.email);
      
      const totalSpent = customerInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
      const totalOrders = customerOrders.length;
      const lastOrderDate = customerOrders.length > 0 ? 
        customerOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))[0].order_date : null;

      return {
        ...customer,
        total_spent: totalSpent,
        total_orders: totalOrders,
        total_invoices: customerInvoices.length,
        last_order_date: lastOrderDate,
        status: totalOrders > 0 ? 'active' : 'inactive'
      };
    });

    // Apply status filter
    if (status) {
      customers = customers.filter(c => c.status === status);
    }

    // Sort by relevance and last updated
    customers.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    const total = customers.length;
    const paginatedCustomers = customers.slice(offset, offset + limit);

    return {
      customers: paginatedCustomers,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getCustomerById(customerId) {
    const customer = this.data.customers.find(c => c.id === parseInt(customerId));
    if (!customer) return null;

    // Add detailed statistics
    const customerInvoices = this.data.invoices.filter(i => i.customer_email === customer.email);
    const customerOrders = this.data.orders.filter(o => o.customer_email === customer.email);
    
    const totalSpent = customerInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    const avgOrderValue = customerOrders.length > 0 ? 
      customerOrders.reduce((sum, ord) => sum + (ord.total_amount || 0), 0) / customerOrders.length : 0;

    return {
      ...customer,
      total_spent: totalSpent,
      total_orders: customerOrders.length,
      total_invoices: customerInvoices.length,
      avg_order_value: avgOrderValue,
      orders: customerOrders,
      invoices: customerInvoices
    };
  }

  async updateCustomer(customerId, customerData) {
    const index = this.data.customers.findIndex(c => c.id === parseInt(customerId));
    if (index === -1) {
      return { changes: 0 };
    }

    const customer = this.data.customers[index];
    this.data.customers[index] = {
      ...customer,
      ...customerData,
      updated_at: new Date().toISOString()
    };

    this.saveData();
    return { changes: 1 };
  }

  async deleteCustomer(customerId) {
    const index = this.data.customers.findIndex(c => c.id === parseInt(customerId));
    if (index === -1) {
      return { changes: 0 };
    }

    this.data.customers.splice(index, 1);
    this.saveData();
    return { changes: 1 };
  }

  async getCustomerStats() {
    const customers = this.data.customers;
    const totalCustomers = customers.length;
    
    // Calculate customer with orders/invoices
    const activeCustomers = customers.filter(c => {
      const hasOrders = this.data.orders.some(o => o.customer_email === c.email);
      const hasInvoices = this.data.invoices.some(i => i.customer_email === c.email);
      return hasOrders || hasInvoices;
    }).length;

    // Calculate repeat customers (more than 1 order)
    const repeatCustomers = customers.filter(c => {
      const orderCount = this.data.orders.filter(o => o.customer_email === c.email).length;
      return orderCount > 1;
    }).length;

    // Calculate total customer lifetime value
    const totalCLV = customers.reduce((sum, customer) => {
      const customerInvoices = this.data.invoices.filter(i => i.customer_email === customer.email);
      const customerTotal = customerInvoices.reduce((invSum, inv) => invSum + (inv.grand_total || 0), 0);
      return sum + customerTotal;
    }, 0);

    return {
      total_customers: totalCustomers,
      active_customers: activeCustomers,
      repeat_customers: repeatCustomers,
      new_customers_this_month: this.getNewCustomersThisMonth(),
      average_clv: totalCustomers > 0 ? totalCLV / totalCustomers : 0,
      total_clv: totalCLV
    };
  }

  getNewCustomersThisMonth() {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return this.data.customers.filter(c => {
      const createdDate = new Date(c.created_at);
      return createdDate >= firstDayThisMonth;
    }).length;
  }

  async exportCustomersToCSV() {
    const customers = await this.getAllCustomers(1000, 0); // Export all customers
    
    const headers = [
      'ID', 'Name', 'Email', 'Phone', 'Address', 
      'Total Orders', 'Total Invoices', 'Total Spent', 
      'Last Order Date', 'Status', 'Created At', 'Updated At'
    ];

    const csvRows = [headers.join(',')];
    
    customers.forEach(customer => {
      const row = [
        customer.id,
        `"${customer.name || ''}"`,
        `"${customer.email || ''}"`,
        `"${customer.phone || ''}"`,
        `"${customer.address || ''}"`,
        customer.total_orders || 0,
        customer.total_invoices || 0,
        customer.total_spent || 0,
        `"${customer.last_order_date || ''}"`,
        `"${customer.status || ''}"`,
        `"${customer.created_at || ''}"`,
        `"${customer.updated_at || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  async getCustomerInvoices(email) {
    return this.data.invoices
      .filter(i => i.customer_email === email)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(invoice => ({
        ...invoice,
        items_json: typeof invoice.items_json === 'string' ? typeof invoice.items_json === 'string' ? JSON.parse(invoice.items_json || '[]') : (invoice.items_json || []) : (invoice.items_json || []),
        metadata_json: typeof invoice.metadata_json === 'string' ? typeof invoice.metadata_json === 'string' ? JSON.parse(invoice.metadata_json || '{}') : (invoice.metadata_json || {}) : (invoice.metadata_json || {})
      }));
  }

  // Invoice operations (basic for compatibility)
  async saveInvoice(invoiceData) {
    const id = this.generateId('invoices');
    const customerToken = this.generateCustomerToken();
    const invoice = invoiceData.invoice || invoiceData;
    
    // Generate unique invoice number
    const invoiceNumber = await this.generateInvoiceNumber();
    
    // Auto-create/update customer record
    await this.saveCustomer({
      name: invoice.customer.name,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      address: invoice.customer.address
    });
    
    const invoiceRecord = {
      id,
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
      original_due_date: invoice.header.dueDate,     // Store original due date
      status: 'draft',
      payment_stage: invoice.paymentSchedule ? 'down_payment' : 'full_payment', // Track payment stage
      payment_status: 'pending', // Track overall payment status
      subtotal: invoice.calculations?.subtotal || invoice.summary?.subtotal || 0,
      tax_amount: invoice.calculations?.totalTax || invoice.summary?.tax_amount || 0,
      shipping_cost: invoice.calculations?.shippingCost || invoice.summary?.shipping_cost || 0,
      discount: invoice.calculations?.discount || invoice.summary?.discount || 0,
      discount_amount: invoice.calculations?.discount || invoice.summary?.discount || 0, // Add discount_amount field for payment schedule detection
      grand_total: invoice.calculations?.grandTotal || invoice.summary?.grand_total || 0,
      currency: invoice.calculations?.currency || invoice.summary?.currency || 'IDR',
      payment_terms: invoice.payment?.paymentTerms || 'Net 30',
      notes: invoice.notes?.publicNotes || '',
      items_json: JSON.stringify(invoice.items),
      metadata_json: JSON.stringify({
        ...invoice.metadata,
        businessProfile: invoiceData.businessProfile || invoice.businessProfile || null
      }),
      payment_schedule_json: (() => {
        // Validate and complete payment schedule before saving
        const paymentSchedule = invoice.paymentSchedule;
        if (paymentSchedule && paymentSchedule.scheduleType === 'down_payment') {
          console.log('🔧 Validating payment schedule before database save...');
          
          // Check if payment schedule is complete
          const hasDownPayment = paymentSchedule.downPayment && 
            typeof paymentSchedule.downPayment.amount === 'number' &&
            typeof paymentSchedule.downPayment.percentage === 'number';
            
          const hasRemainingBalance = paymentSchedule.remainingBalance && 
            typeof paymentSchedule.remainingBalance.amount === 'number';
          
          if (hasDownPayment && hasRemainingBalance) {
            console.log('✅ Payment schedule is complete, saving to database');
            return JSON.stringify(paymentSchedule);
          } else {
            console.log('❌ Warning: Incomplete payment schedule detected during save, using null');
            return JSON.stringify(null);
          }
        }
        return JSON.stringify(paymentSchedule || null);
      })(), // Add payment schedule with validation
      notes_json: JSON.stringify(invoice.notes || {}), // Add notes JSON
      calculations_json: JSON.stringify(invoice.calculations || {}), // Add calculations JSON
      customer_token: customerToken,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.data.invoices.push(invoiceRecord);
    this.saveData();

    return {
      ...invoiceRecord,
      invoiceNumber: invoiceNumber,
      customerToken
    };
  }

  async getAllInvoices(limit = 50, offset = 0, status = null, customerEmail = null, dateFrom = null, dateTo = null) {
    let invoices = [...this.data.invoices];

    if (status) {
      invoices = invoices.filter(i => i.status === status);
    }

    if (customerEmail) {
      invoices = invoices.filter(i => i.customer_email === customerEmail);
    }

    // Date filtering
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      invoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
        return invoiceDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      invoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
        return invoiceDate <= toDate;
      });
    }

    invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return invoices.slice(offset, offset + limit).map(invoice => ({
      ...invoice,
      items_json: typeof invoice.items_json === 'string' ? typeof invoice.items_json === 'string' ? JSON.parse(invoice.items_json || '[]') : (invoice.items_json || []) : (invoice.items_json || []),
      metadata_json: typeof invoice.metadata_json === 'string' ? typeof invoice.metadata_json === 'string' ? JSON.parse(invoice.metadata_json || '{}') : (invoice.metadata_json || {}) : (invoice.metadata_json || {})
    }));
  }

  async searchInvoices(searchTerm, status = null, dateFrom = null, dateTo = null, limit = 50, offset = 0) {
    let invoices = [...this.data.invoices];

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      invoices = invoices.filter(invoice => 
        invoice.invoice_number?.toLowerCase().includes(term) ||
        invoice.customer_name?.toLowerCase().includes(term) ||
        invoice.customer_email?.toLowerCase().includes(term) ||
        invoice.merchant_name?.toLowerCase().includes(term) ||
        invoice.notes?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (status) {
      invoices = invoices.filter(i => i.status === status);
    }

    // Apply date filters
    if (dateFrom) {
      invoices = invoices.filter(i => new Date(i.invoice_date) >= new Date(dateFrom));
    }
    if (dateTo) {
      invoices = invoices.filter(i => new Date(i.invoice_date) <= new Date(dateTo));
    }

    // Sort by relevance and date
    invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = invoices.length;
    const paginatedInvoices = invoices.slice(offset, offset + limit);

    return {
      invoices: paginatedInvoices.map(invoice => ({
        ...invoice,
        items_json: typeof invoice.items_json === 'string' ? typeof invoice.items_json === 'string' ? JSON.parse(invoice.items_json || '[]') : (invoice.items_json || []) : (invoice.items_json || []),
        metadata_json: typeof invoice.metadata_json === 'string' ? typeof invoice.metadata_json === 'string' ? JSON.parse(invoice.metadata_json || '{}') : (invoice.metadata_json || {}) : (invoice.metadata_json || {})
      })),
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Safe JSON parse helper
  safeJsonParse(jsonString, fallback = null) {
    try {
      // Handle null or undefined values
      if (!jsonString) {
        return fallback;
      }
      
      // Handle string inputs
      if (typeof jsonString === 'string') {
        const trimmed = jsonString.trim();
        
        // Handle empty strings
        if (!trimmed) {
          return fallback;
        }
        
        // Handle literal "null" strings (common in database)
        if (trimmed === 'null') {
          return fallback;
        }
        
        // Handle literal "undefined" strings
        if (trimmed === 'undefined') {
          return fallback;
        }
        
        // Try to parse valid JSON
        return JSON.parse(trimmed);
      }
      
      // If it's already an object, return as-is
      return jsonString;
      
    } catch (error) {
      console.warn('JSON parse error:', error.message, 'Input:', jsonString);
      return fallback;
    }
  }

  async getInvoice(id) {
    const invoice = this.data.invoices.find(i => i.id === parseInt(id));
    if (!invoice) return null;

    try {
      return {
        ...invoice,
        items_json: this.safeJsonParse(invoice.items_json, []),
        metadata_json: this.safeJsonParse(invoice.metadata_json, {}),
        payment_schedule_json: this.safeJsonParse(invoice.payment_schedule_json, {}),
        notes_json: this.safeJsonParse(invoice.notes_json, {}),
        calculations_json: this.safeJsonParse(invoice.calculations_json, {})
      };
    } catch (error) {
      console.error('Error processing invoice data:', error);
      // Return invoice without JSON parsing if there's an issue
      return invoice;
    }
  }

  async getInvoiceByNumber(invoiceNumber) {
    const invoice = this.data.invoices.find(i => i.invoice_number === invoiceNumber);
    if (!invoice) return null;

    try {
      return {
        ...invoice,
        items_json: this.safeJsonParse(invoice.items_json, []),
        metadata_json: this.safeJsonParse(invoice.metadata_json, {}),
        payment_schedule_json: this.safeJsonParse(invoice.payment_schedule_json, {}),
        notes_json: this.safeJsonParse(invoice.notes_json, {}),
        calculations_json: this.safeJsonParse(invoice.calculations_json, {})
      };
    } catch (error) {
      console.error('Error processing invoice data:', error);
      return invoice;
    }
  }

  async getInvoiceByCustomerToken(token) {
    const invoice = this.data.invoices.find(i => i.customer_token === token);
    if (!invoice) return null;

    try {
      return {
        ...invoice,
        items_json: this.safeJsonParse(invoice.items_json, []),
        metadata_json: this.safeJsonParse(invoice.metadata_json, {}),
        payment_schedule_json: this.safeJsonParse(invoice.payment_schedule_json, {}),
        notes_json: this.safeJsonParse(invoice.notes_json, {}),
        calculations_json: this.safeJsonParse(invoice.calculations_json, {})
      };
    } catch (error) {
      console.error('Error processing invoice data:', error);
      return invoice;
    }
  }

  async updateInvoiceStatus(invoiceId, status) {
    const index = this.data.invoices.findIndex(i => i.id === parseInt(invoiceId));
    if (index === -1) {
      return { changes: 0 };
    }

    const invoice = this.data.invoices[index];
    invoice.status = status;
    invoice.updated_at = new Date().toISOString();
    
    if (status === 'sent') {
      invoice.sent_at = new Date().toISOString();
    } else if (status === 'paid') {
      invoice.paid_at = new Date().toISOString();
      
      // Extract customer data from paid invoice
      try {
        const CustomerExtractionService = await import('./customer-extraction-service.js');
        const customerService = new CustomerExtractionService.default(this);
        const extractionResult = await customerService.extractFromPaidInvoice(invoice);
        
        if (extractionResult.success) {
          console.log(`✅ Customer data extracted for invoice ${invoice.invoice_number}: ${extractionResult.action}`);
        } else {
          console.log(`⚠️ Customer extraction skipped for invoice ${invoice.invoice_number}: ${extractionResult.reason || extractionResult.error}`);
        }
      } catch (error) {
        console.error(`❌ Customer extraction failed for invoice ${invoice.invoice_number}:`, error);
      }
      
      // For payment schedule invoices, update payment status based on stage
      if (invoice.payment_stage === 'down_payment') {
        // Down payment completed, move to final payment stage
        invoice.payment_stage = 'final_payment';
        invoice.payment_status = 'partial';
        console.log(`Invoice ${invoice.invoice_number} - Down payment completed, moved to final payment stage`);
      } else if (invoice.payment_stage === 'final_payment') {
        // Final payment completed
        invoice.payment_stage = 'completed';
        invoice.payment_status = 'completed';
        console.log(`Invoice ${invoice.invoice_number} - All payments completed`);
        
        // AUTO-CREATE ORDER WHEN FULLY PAID
        try {
          const orderResult = await this.createOrderFromInvoice(invoiceId);
          console.log(`Order automatically created from fully paid invoice ${invoice.invoice_number}`);
          // Return order creation info
          return {
            invoice,
            orderCreated: true,
            orderId: orderResult.lastInsertRowid,
            orderNumber: orderResult.orderNumber
          };
        } catch (error) {
          console.error('Failed to auto-create order from invoice:', error);
          // Don't fail the status update if order creation fails
        }
      } else {
        // Full payment (no payment schedule)
        invoice.payment_stage = 'completed';
        invoice.payment_status = 'completed';
        
        // AUTO-CREATE ORDER WHEN PAID
        try {
          const orderResult = await this.createOrderFromInvoice(invoiceId);
          console.log(`Order automatically created from paid invoice ${invoice.invoice_number}`);
          // Return order creation info
          return {
            invoice,
            orderCreated: true,
            orderId: orderResult.lastInsertRowid,
            orderNumber: orderResult.orderNumber
          };
        } catch (error) {
          console.error('Failed to auto-create order from invoice:', error);
          // Don't fail the status update if order creation fails
        }
      }
    }

    this.saveData();
    return { changes: 1 };
  }

  // Add payment confirmation to invoice
  async addPaymentConfirmation(invoiceId, confirmationData) {
    const index = this.data.invoices.findIndex(i => i.id === parseInt(invoiceId));
    if (index === -1) {
      console.log('❌ Invoice not found for payment confirmation:', invoiceId);
      return null;
    }
    
    const invoice = this.data.invoices[index];
    
    // Add payment confirmation fields
    invoice.payment_confirmation_file = confirmationData.filePath;
    invoice.payment_confirmation_notes = confirmationData.notes || '';
    invoice.payment_confirmation_date = new Date().toISOString();
    invoice.confirmation_status = 'pending'; // 'pending', 'approved', 'rejected'
    invoice.payment_status = 'confirmation_pending';
    invoice.updated_at = new Date().toISOString();
    
    this.saveData();
    console.log(`✅ Payment confirmation added for invoice ${invoice.invoice_number}`);
    return invoice;
  }

  // Update payment confirmation status (for merchant approval/rejection)
  async updatePaymentConfirmationStatus(invoiceId, status, merchantNotes = '') {
    const index = this.data.invoices.findIndex(i => i.id === parseInt(invoiceId));
    if (index === -1) {
      console.log('❌ Invoice not found for confirmation status update:', invoiceId);
      return null;
    }
    
    const invoice = this.data.invoices[index];
    
    invoice.confirmation_status = status; // 'approved', 'rejected'
    invoice.merchant_confirmation_notes = merchantNotes;
    invoice.confirmation_reviewed_date = new Date().toISOString();
    
    // Update payment status based on confirmation status and payment stage
    if (status === 'approved') {
      const paymentStage = invoice.payment_stage || 'full_payment';
      
      if (paymentStage === 'down_payment') {
        // Down payment confirmed - move to final payment stage
        invoice.payment_status = 'partial';
        invoice.status = 'dp_paid';
        invoice.payment_stage = 'final_payment';
        console.log(`Down payment confirmed for invoice ${invoice.invoice_number} - moved to final payment stage`);
      } else if (paymentStage === 'final_payment') {
        // Final payment confirmed - complete the invoice and create order
        invoice.payment_status = 'paid';
        invoice.status = 'paid';
        invoice.payment_stage = 'completed';
        
        // Auto-create order for final payment
        try {
          const orderResult = await this.createOrderFromInvoice(invoiceId);
          console.log(`Order automatically created from final payment confirmation: ${orderResult.orderNumber}`);
          
          // Return order creation info
          return {
            ...invoice,
            orderCreated: true,
            orderId: orderResult.lastInsertRowid,
            orderNumber: orderResult.orderNumber
          };
        } catch (error) {
          console.error('Failed to auto-create order from final payment:', error);
        }
      } else {
        // Full payment confirmed - complete and create order
        invoice.payment_status = 'paid';
        invoice.status = 'paid';
        invoice.payment_stage = 'completed';
        
        // Auto-create order for full payment
        try {
          const orderResult = await this.createOrderFromInvoice(invoiceId);
          console.log(`Order automatically created from full payment confirmation: ${orderResult.orderNumber}`);
          
          // Return order creation info
          return {
            ...invoice,
            orderCreated: true,
            orderId: orderResult.lastInsertRowid,
            orderNumber: orderResult.orderNumber
          };
        } catch (error) {
          console.error('Failed to auto-create order from full payment:', error);
        }
      }
    } else if (status === 'rejected') {
      invoice.payment_status = 'pending';
    }
    
    invoice.updated_at = new Date().toISOString();
    this.saveData();
    
    console.log(`✅ Payment confirmation ${status} for invoice ${invoice.invoice_number}`);
    return invoice;
  }

  async updatePaymentStage(invoiceId, paymentStage, paymentStatus = null) {
    const index = this.data.invoices.findIndex(i => i.id === parseInt(invoiceId));
    if (index === -1) {
      console.log('❌ Invoice not found for payment stage update:', invoiceId);
      return { changes: 0 };
    }

    const invoice = this.data.invoices[index];
    invoice.payment_stage = paymentStage;
    if (paymentStatus) {
      invoice.payment_status = paymentStatus;
    }
    invoice.updated_at = new Date().toISOString();

    console.log(`✅ Updated payment stage for invoice ${invoice.invoice_number}: ${paymentStage} (${paymentStatus || 'status unchanged'})`);

    this.saveData();
    return { changes: 1 };
  }

  async updateInvoice(invoiceId, invoiceData) {
    const index = this.data.invoices.findIndex(i => i.id === parseInt(invoiceId));
    if (index === -1) {
      console.log('❌ Invoice not found for update:', invoiceId);
      return null;
    }

    const existingInvoice = this.data.invoices[index];
    const invoice = invoiceData.invoice || invoiceData;
    
    console.log('📝 Updating existing invoice:', invoiceId);
    
    // Auto-update customer record
    await this.saveCustomer({
      name: invoice.customer.name,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      address: invoice.customer.address
    });
    
    // Update existing record, preserving ID, invoice_number, created_at, and customer_token
    const updatedInvoice = {
      ...existingInvoice, // Preserve original ID, invoice_number, created_at, customer_token
      // Update all editable fields
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
      // Preserve original_due_date if it exists, otherwise set to current due_date
      original_due_date: existingInvoice.original_due_date || invoice.header.dueDate,
      // Update payment stage only if it's explicitly provided, otherwise preserve existing
      payment_stage: invoice.paymentSchedule ? 'down_payment' : (existingInvoice.payment_stage || 'full_payment'),
      subtotal: invoice.calculations.subtotal,
      tax_amount: invoice.calculations.totalTax,
      shipping_cost: invoice.calculations.shippingCost,
      discount: invoice.calculations.discount,
      discount_amount: invoice.calculations.discount, // Add discount_amount field
      grand_total: invoice.calculations.grandTotal,
      currency: invoice.calculations.currency,
      payment_terms: invoice.payment?.paymentTerms || 'Net 30',
      notes: invoice.notes?.publicNotes || '',
      items_json: JSON.stringify(invoice.items),
      metadata_json: JSON.stringify({
        ...invoice.metadata,
        businessProfile: invoiceData.businessProfile || invoice.businessProfile || null
      }),
      payment_schedule_json: JSON.stringify(invoice.paymentSchedule || null), // Add payment schedule
      notes_json: JSON.stringify(invoice.notes || {}), // Add notes JSON
      calculations_json: JSON.stringify(invoice.calculations || {}), // Add calculations JSON
      updated_at: new Date().toISOString()
    };

    this.data.invoices[index] = updatedInvoice;
    this.saveData();

    console.log('✅ Invoice updated successfully:', updatedInvoice.invoice_number);

    return {
      ...updatedInvoice,
      invoiceNumber: updatedInvoice.invoice_number,
      customerToken: updatedInvoice.customer_token
    };
  }

  async deleteInvoice(invoiceId) {
    const index = this.data.invoices.findIndex(i => i.id === parseInt(invoiceId));
    if (index === -1) {
      return { changes: 0 };
    }

    this.data.invoices.splice(index, 1);
    this.saveData();
    return { changes: 1 };
  }

  async getInvoiceStats(dateFrom = null, dateTo = null) {
    let invoices = this.data.invoices;
    
    // Apply date filtering if provided
    if (dateFrom || dateTo) {
      invoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.date || invoice.created_at);
        if (dateFrom && invoiceDate < new Date(dateFrom)) return false;
        if (dateTo && invoiceDate > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      });
    }
    
    return {
      total_invoices: invoices.length,
      draft_invoices: invoices.filter(i => i.status === 'draft').length,
      sent_invoices: invoices.filter(i => i.status === 'sent').length,
      paid_invoices: invoices.filter(i => i.status === 'paid').length,
      total_paid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.grand_total, 0),
      total_revenue: invoices.reduce((sum, i) => sum + i.grand_total, 0)
    };
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
      const existingInvoice = this.data.invoices.find(inv => 
        inv.invoice_number && inv.invoice_number === fullNumber
      );
      const existingOrder = this.data.orders.find(order => 
        order.order_number && order.order_number === fullNumber
      );
      
      if (!existingInvoice && !existingOrder) {
        return hash;
      }
      
      attempts++;
    }
    
    // Fallback to timestamp-based if we can't find unique hash
    return Date.now().toString(36).substr(-4).toUpperCase();
  }

  generateBusinessCode(businessName) {
    if (!businessName) return 'BIZ';
    
    // For "BEVELIENT", take first 3 chars: "BEV"
    // For multi-word names, take first letter of each word
    const words = businessName.trim().split(/\s+/);
    
    if (words.length === 1) {
      // Single word: take first 3 characters
      return words[0].substring(0, 3).toUpperCase();
    } else {
      // Multiple words: take first letter of each word (up to 3)
      return words
        .slice(0, 3)
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase();
    }
  }

  async generateInvoiceNumber() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const dateString = `${year}${month}${day}`;
    const prefix = `INV`;
    
    // Generate unique hash for privacy
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
    
    // Generate unique hash for privacy
    const hash = await this.generateUniqueHash(prefix, dateString);
    
    return `${prefix}-${dateString}-${hash}`;
  }

  // Order CRUD operations
  async createOrder(orderData) {
    console.log('Creating order with data:', orderData);
    
    const id = this.generateId('orders');
    const orderNumber = await this.generateOrderNumber();
    
    // Auto-create/update customer record
    await this.saveCustomer({
      name: orderData.customer_name,
      email: orderData.customer_email,
      phone: orderData.customer_phone,
      address: orderData.shipping_address || orderData.billing_address
    });
    
    const order = {
      id,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.data.orders.push(order);
    console.log('Order added to data:', order);

    // Save order items if provided
    if (orderData.items && Array.isArray(orderData.items)) {
      console.log('Processing order items:', orderData.items);
      orderData.items.forEach(item => {
        const orderItemId = this.generateId('order_items');
        const orderItem = {
          id: orderItemId,
          order_id: id,
          product_id: item.product_id,
          product_name: item.product_name || item.name,
          sku: item.sku || '',
          quantity: item.quantity,
          unit_price: item.unit_price || item.price,
          line_total: item.line_total || (item.quantity * (item.unit_price || item.price))
        };
        this.data.order_items.push(orderItem);
        console.log('Order item added:', orderItem);
      });
    }

    this.saveData();
    console.log('Order creation completed:', { id, orderNumber });
    
    return { lastInsertRowid: id, orderNumber: orderNumber };
  }

  async getOrder(id) {
    const order = this.data.orders.find(o => o.id === parseInt(id));
    if (!order) return null;

    // Get order items
    const items = this.data.order_items.filter(item => item.order_id === parseInt(id));
    
    return {
      ...order,
      items: items
    };
  }

  async getAllOrders(limit = 50, offset = 0, status = null, customerEmail = null, dateFrom = null, dateTo = null) {
    let orders = [...this.data.orders];

    // Apply filters
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    if (customerEmail) {
      orders = orders.filter(o => o.customer_email === customerEmail);
    }

    if (dateFrom) {
      orders = orders.filter(o => new Date(o.order_date) >= new Date(dateFrom));
    }

    if (dateTo) {
      orders = orders.filter(o => new Date(o.order_date) <= new Date(dateTo));
    }

    // Sort by created_at DESC
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply pagination
    const paginatedOrders = orders.slice(offset, offset + limit);

    // Add items to each order
    return paginatedOrders.map(order => {
      const items = this.data.order_items.filter(item => item.order_id === order.id);
      return {
        ...order,
        items: items
      };
    });
  }

  async searchOrders(searchTerm, status = null, customerEmail = null, dateFrom = null, dateTo = null, limit = 50, offset = 0) {
    let orders = [...this.data.orders];

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      orders = orders.filter(order => 
        order.order_number?.toLowerCase().includes(term) ||
        order.customer_name?.toLowerCase().includes(term) ||
        order.customer_email?.toLowerCase().includes(term) ||
        order.tracking_number?.toLowerCase().includes(term) ||
        order.notes?.toLowerCase().includes(term)
      );
    }

    // Apply other filters
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    if (customerEmail) {
      orders = orders.filter(o => o.customer_email === customerEmail);
    }

    if (dateFrom) {
      orders = orders.filter(o => new Date(o.order_date) >= new Date(dateFrom));
    }

    if (dateTo) {
      orders = orders.filter(o => new Date(o.order_date) <= new Date(dateTo));
    }

    // Sort by relevance and created date
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = orders.length;
    const paginatedOrders = orders.slice(offset, offset + limit);

    // Add items to each order
    const ordersWithItems = paginatedOrders.map(order => {
      const items = this.data.order_items.filter(item => item.order_id === order.id);
      return {
        ...order,
        items: items
      };
    });

    return {
      orders: ordersWithItems,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateOrderStatus(orderId, status, additionalData = {}) {
    const index = this.data.orders.findIndex(o => o.id === parseInt(orderId));
    if (index === -1) {
      return { changes: 0 };
    }

    const order = this.data.orders[index];
    order.status = status;
    order.updated_at = new Date().toISOString();
    
    // Set timestamps based on status
    if (status === 'shipped' && !order.shipped_date) {
      order.shipped_date = new Date().toISOString();
    } else if (status === 'delivered' && !order.delivered_date) {
      order.delivered_date = new Date().toISOString();
    }

    // Update additional data
    if (additionalData.tracking_number) {
      order.tracking_number = additionalData.tracking_number;
    }
    if (additionalData.notes) {
      order.notes = additionalData.notes;
    }

    this.saveData();
    return { changes: 1 };
  }

  async bulkUpdateOrderStatus(orderIds, status, additionalData = {}) {
    let updatedCount = 0;
    
    orderIds.forEach(orderId => {
      const index = this.data.orders.findIndex(o => o.id === parseInt(orderId));
      if (index !== -1) {
        const order = this.data.orders[index];
        order.status = status;
        order.updated_at = new Date().toISOString();
        
        if (status === 'shipped' && !order.shipped_date) {
          order.shipped_date = new Date().toISOString();
        } else if (status === 'delivered' && !order.delivered_date) {
          order.delivered_date = new Date().toISOString();
        }

        if (additionalData.tracking_number) {
          order.tracking_number = additionalData.tracking_number;
        }
        
        updatedCount++;
      }
    });

    this.saveData();
    return { changes: updatedCount };
  }

  async deleteOrder(orderId) {
    const orderIndex = this.data.orders.findIndex(o => o.id === parseInt(orderId));
    if (orderIndex === -1) {
      return { changes: 0 };
    }

    // Remove order items
    this.data.order_items = this.data.order_items.filter(item => item.order_id !== parseInt(orderId));
    
    // Remove order
    this.data.orders.splice(orderIndex, 1);
    
    this.saveData();
    return { changes: 1 };
  }

  async convertOrderToInvoice(orderId) {
    const order = await this.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Create invoice data from order
    const invoiceData = {
      invoice: {
        header: {
          invoiceNumber: '', // Will be generated
          invoiceDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        },
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
          address: order.shipping_address || order.billing_address
        },
        merchant: {
          businessName: "Toko Gadget Teknologi",
          address: "Jl. Teknologi No. 123, Jakarta Selatan, DKI Jakarta 12345",
          phone: "+62 21 1234 5678",
          email: "billing@tokogadget.co.id"
        },
        items: order.items.map(item => ({
          productName: item.product_name,
          description: '',
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          lineTotal: item.line_total,
          taxRate: 11,
          taxAmount: item.line_total * 0.11
        })),
        calculations: {
          subtotal: order.subtotal,
          totalTax: order.tax_amount,
          shippingCost: order.shipping_cost,
          discount: order.discount,
          grandTotal: order.total_amount,
          currency: 'IDR'
        },
        payment: {
          paymentTerms: 'NET_30'
        },
        notes: {
          publicNotes: `Converted from Order: ${order.order_number}. ${order.notes}`
        },
        metadata: {
          sourceOrderId: order.id,
          sourceOrderNumber: order.order_number
        }
      }
    };

    // Save the invoice
    const savedInvoice = await this.saveInvoice(invoiceData);
    
    // Update order status to 'invoiced'
    await this.updateOrderStatus(orderId, 'invoiced', {
      notes: `${order.notes} [Converted to Invoice: ${savedInvoice.invoiceNumber}]`
    });

    return savedInvoice;
  }

  async createOrderFromInvoice(invoiceId) {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Check if order already exists for this invoice
    const existingOrder = this.data.orders.find(o => 
      o.source_invoice_id === parseInt(invoiceId) || 
      (o.notes && o.notes.includes(invoice.invoice_number))
    );
    
    if (existingOrder) {
      console.log(`Order ${existingOrder.order_number} already exists for invoice ${invoice.invoice_number}`);
      return existingOrder;
    }

    // Parse invoice items
    const invoiceItems = Array.isArray(invoice.items_json) ? invoice.items_json : typeof invoice.items_json === 'string' ? JSON.parse(invoice.items_json || '[]') : (invoice.items_json || []);
    
    // Create order data from invoice
    const orderData = {
      customer_name: invoice.customer_name,
      customer_email: invoice.customer_email,
      customer_phone: invoice.customer_phone,
      shipping_address: invoice.customer_address,
      billing_address: invoice.customer_address,
      status: 'pending',
      payment_status: 'paid', // Invoice is paid
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

    console.log('Creating order from invoice data:', orderData);
    const result = await this.createOrder(orderData);
    
    // Update invoice metadata to reference the created order
    const invoiceIndex = this.data.invoices.findIndex(i => i.id === parseInt(invoiceId));
    if (invoiceIndex !== -1) {
      const metadata = JSON.parse(this.data.invoices[invoiceIndex].metadata_json || '{}');
      metadata.auto_created_order_id = result.lastInsertRowid;
      metadata.auto_created_order_number = result.orderNumber;
      this.data.invoices[invoiceIndex].metadata_json = JSON.stringify(metadata);
      this.saveData();
    }

    console.log(`Order ${result.orderNumber} auto-created from invoice ${invoice.invoice_number}`);
    return result;
  }

  async getOrderStats(dateFrom = null, dateTo = null) {
    let orders = [...this.data.orders];
    
    // Apply date filters if provided
    if (dateFrom) {
      orders = orders.filter(o => new Date(o.order_date) >= new Date(dateFrom));
    }
    
    if (dateTo) {
      orders = orders.filter(o => new Date(o.order_date) <= new Date(dateTo));
    }
    
    return {
      total_orders: orders.length,
      pending_orders: orders.filter(o => o.status === 'pending').length,
      shipped_orders: orders.filter(o => o.status === 'shipped').length,
      delivered_orders: orders.filter(o => o.status === 'delivered').length,
      total_order_value: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      avg_order_value: orders.length > 0 ? orders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / orders.length : 0
    };
  }

  // Access logging for security
  async logAccess(accessData) {
    const id = this.generateId('access_logs');
    const log = {
      id,
      ip_address: accessData.ip,
      user_agent: accessData.userAgent,
      access_type: accessData.type, // 'token' or 'email'
      customer_email: accessData.email,
      invoice_id: accessData.invoiceId,
      success: accessData.success,
      created_at: new Date().toISOString()
    };

    this.data.access_logs.push(log);
    this.saveData();
    return { lastInsertRowid: id };
  }

  async getAccessLogs(limit = 100, offset = 0) {
    return this.data.access_logs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit);
  }

  // Business Settings CRUD operations
  async getBusinessSettings() {
    return this.data.business_settings || {};
  }

  async updateBusinessSettings(settings) {
    if (!this.data.business_settings) {
      this.data.business_settings = {};
    }

    // Auto-generate business code from business name if name is provided and code is empty
    if (settings.name && (!settings.businessCode && !this.data.business_settings.businessCode)) {
      settings.businessCode = this.generateBusinessCode(settings.name);
      console.log(`🏢 Auto-generated business code: ${settings.businessCode} from name: ${settings.name}`);
    }

    this.data.business_settings = {
      ...this.data.business_settings,
      ...settings,
      updatedAt: new Date().toISOString()
    };

    this.saveData();
    return this.data.business_settings;
  }

  // Payment Methods CRUD operations
  async getPaymentMethods() {
    if (!this.data.payment_methods) {
      this.data.payment_methods = {
        bankTransfer: { enabled: false },
        xendit: { enabled: false }
      };
    }
    
    // Decrypt sensitive data before returning
    const methods = { ...this.data.payment_methods };
    
    if (methods.xendit && methods.xendit.secretKey) {
      methods.xendit.secretKey = cryptoHelper.simpleDecrypt(methods.xendit.secretKey);
    }
    
    if (methods.xendit && methods.xendit.webhookToken) {
      methods.xendit.webhookToken = cryptoHelper.simpleDecrypt(methods.xendit.webhookToken);
    }
    
    return methods;
  }

  async updatePaymentMethods(methods) {
    if (!this.data.payment_methods) {
      this.data.payment_methods = {};
    }

    // Encrypt sensitive Xendit data before storing
    const processedMethods = { ...methods };
    
    if (processedMethods.xendit) {
      if (processedMethods.xendit.secretKey && !cryptoHelper.isEncrypted(processedMethods.xendit.secretKey)) {
        processedMethods.xendit.secretKey = cryptoHelper.simpleEncrypt(processedMethods.xendit.secretKey);
      }
      
      if (processedMethods.xendit.webhookToken && !cryptoHelper.isEncrypted(processedMethods.xendit.webhookToken)) {
        processedMethods.xendit.webhookToken = cryptoHelper.simpleEncrypt(processedMethods.xendit.webhookToken);
      }
      
      processedMethods.xendit.updatedAt = new Date().toISOString();
    }

    // Merge with existing data
    this.data.payment_methods = {
      ...this.data.payment_methods,
      ...processedMethods
    };

    this.saveData();
    
    // Return decrypted data for immediate use
    return await this.getPaymentMethods();
  }

  // Get decrypted Xendit credentials for API use
  async getXenditCredentials() {
    const methods = this.data.payment_methods;
    if (!methods || !methods.xendit || !methods.xendit.enabled) {
      return null;
    }

    const xendit = methods.xendit;
    return {
      environment: xendit.environment || 'sandbox',
      secretKey: xendit.secretKey ? cryptoHelper.simpleDecrypt(xendit.secretKey) : null,
      publicKey: xendit.publicKey || '',
      webhookToken: xendit.webhookToken ? cryptoHelper.simpleDecrypt(xendit.webhookToken) : null,
      paymentMethods: xendit.paymentMethods || {}
    };
  }

  // Check if Xendit is configured and enabled
  async isXenditEnabled() {
    const credentials = await this.getXenditCredentials();
    return credentials && credentials.secretKey && credentials.secretKey.length > 0;
  }

  // Account Settings CRUD operations
  async getAccountSettings() {
    return this.data.account_settings || {};
  }

  async updateAccountSettings(settings) {
    if (!this.data.account_settings) {
      this.data.account_settings = {};
    }

    this.data.account_settings = {
      ...this.data.account_settings,
      ...settings,
      updatedAt: new Date().toISOString()
    };

    this.saveData();
    return this.data.account_settings;
  }

  // Usage Statistics
  async getUsageStatistics() {
    const currentMonth = new Date();
    const firstDayThisMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    // Count invoices this month
    const invoicesThisMonth = this.data.invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.created_at);
      return invoiceDate >= firstDayThisMonth;
    }).length;

    // Total customers
    const totalCustomers = this.data.customers ? this.data.customers.length : 0;

    // Total revenue from paid invoices
    const totalRevenue = this.data.invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((total, invoice) => total + (invoice.total_amount || 0), 0);

    // Email count (placeholder - could be tracked separately)
    const emailsSent = this.data.email_logs ? this.data.email_logs.length : 0;

    return {
      invoicesCount: invoicesThisMonth,
      customersCount: totalCustomers,
      totalRevenue: totalRevenue,
      emailsSent: emailsSent
    };
  }

  // Subscription Info
  async getSubscriptionInfo() {
    return this.data.subscription || {
      plan: 'free',
      planName: 'Free Plan',
      startDate: new Date().toISOString(),
      features: [
        'Unlimited invoices',
        'Up to 100 customers',
        'Basic payment methods',
        'Email support',
        'Standard templates'
      ]
    };
  }

  // Data Export
  async exportAllData() {
    return {
      exportDate: new Date().toISOString(),
      businessSettings: this.data.business_settings || {},
      accountSettings: this.data.account_settings || {},
      customers: this.data.customers || [],
      products: this.data.products || [],
      invoices: this.data.invoices || [],
      orders: this.data.orders || [],
      categories: this.data.categories || [],
      paymentMethods: this.data.payment_methods || {},
      subscription: this.data.subscription || {}
    };
  }

  // Backup Creation (simplified - returns JSON string)
  async createBackup() {
    const backupData = await this.exportAllData();
    return JSON.stringify(backupData, null, 2);
  }

  // Account Reset
  async resetAccountData() {
    console.log('🔄 Resetting account data...');
    
    // Keep business settings and account settings, reset everything else
    const businessSettings = this.data.business_settings || {};
    const accountSettings = this.data.account_settings || {};
    
    this.data = {
      business_settings: businessSettings,
      account_settings: accountSettings,
      customers: [],
      products: [],
      invoices: [],
      orders: [],
      categories: [],
      payment_methods: {
        bankTransfer: { enabled: false },
        xendit: { enabled: false }
      },
      subscription: {
        plan: 'free',
        planName: 'Free Plan',
        startDate: new Date().toISOString()
      },
      access_logs: [],
      email_logs: []
    };

    this.saveData();
    console.log('✅ Account data reset completed');
  }

  // ==========================================
  // MERCHANT USER MANAGEMENT METHODS
  // ==========================================

  /**
   * Initialize merchants array if not exists
   */
  initializeMerchants() {
    if (!this.data.merchants) {
      this.data.merchants = [];
      this.saveData();
    }
  }

  /**
   * Create a new merchant user
   */
  async createMerchant(merchantData) {
    this.initializeMerchants();
    
    const id = this.generateId('merchants');
    const merchant = {
      id,
      ...merchantData,
      createdAt: merchantData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.merchants.push(merchant);
    this.saveData();

    console.log(`👤 New merchant created: ${merchant.email} (${merchant.businessName})`);
    return merchant;
  }

  /**
   * Get merchant by email
   */
  async getMerchant(email) {
    this.initializeMerchants();
    return this.data.merchants.find(m => m.email === email.toLowerCase());
  }

  /**
   * Get merchant by ID
   */
  async getMerchantById(id) {
    this.initializeMerchants();
    return this.data.merchants.find(m => m.id === parseInt(id));
  }

  /**
   * Get merchant by reset token
   */
  async getMerchantByResetToken(resetToken) {
    this.initializeMerchants();
    return this.data.merchants.find(m => m.resetToken === resetToken);
  }

  /**
   * Update merchant data
   */
  async updateMerchant(id, updateData) {
    this.initializeMerchants();
    
    const merchantIndex = this.data.merchants.findIndex(m => m.id === parseInt(id));
    if (merchantIndex === -1) {
      throw new Error('Merchant not found');
    }

    // Update merchant data
    this.data.merchants[merchantIndex] = {
      ...this.data.merchants[merchantIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.saveData();
    
    console.log(`👤 Merchant updated: ${this.data.merchants[merchantIndex].email}`);
    return this.data.merchants[merchantIndex];
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
    this.initializeMerchants();
    return this.data.merchants.filter(m => m.status !== 'inactive');
  }

  /**
   * Get merchant statistics
   */
  async getMerchantStats() {
    this.initializeMerchants();
    
    const totalMerchants = this.data.merchants.length;
    const activeMerchants = this.data.merchants.filter(m => m.status === 'active').length;
    const verifiedMerchants = this.data.merchants.filter(m => m.emailVerified).length;
    const recentLogins = this.data.merchants.filter(m => {
      if (!m.lastLogin) return false;
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(m.lastLogin) > lastWeek;
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

export default SimpleDatabase;