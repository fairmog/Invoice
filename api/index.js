import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Basic configuration
const config = {
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production'
};

// Performance metrics tracking
const performanceMetrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0
  }
};

// Initialize OpenAI
let openai = null;
const hasOpenAI = !!process.env.OPENAI_API_KEY;

if (hasOpenAI) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI initialized successfully');
  } catch (error) {
    console.error('❌ OpenAI initialization failed:', error.message);
  }
}

// Simple in-memory database
const database = {
  invoices: [],
  customers: [],
  products: []
};

// Security and middleware setup
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cookieParser());

// CORS configuration
const corsOptions = {
  origin: config.cors.origin === '*' ? true : config.cors.origin.split(','),
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/static', express.static(path.join(__dirname, '../public')));
app.use('/favicon.ico', (req, res) => res.status(204).end());

// Performance monitoring middleware
app.use((req, res, next) => {
  performanceMetrics.requests.total++;
  
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      performanceMetrics.requests.successful++;
    } else {
      performanceMetrics.requests.failed++;
    }
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    performance: performanceMetrics,
    features: {
      openaiService: hasOpenAI,
      invoiceGeneration: true,
      database: true
    }
  });
});

// Invoice generation endpoint
app.post('/api/generate-invoice', async (req, res) => {
  try {
    if (!hasOpenAI || !openai) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Please check OpenAI API key configuration.'
      });
    }

    const { customerInfo, items, businessInfo, additionalNotes } = req.body;

    if (!customerInfo || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer information and items are required.'
      });
    }

    // Generate invoice content using OpenAI
    const prompt = `Generate a professional invoice based on the following information:

Business Information:
${businessInfo ? JSON.stringify(businessInfo, null, 2) : 'Use default business information'}

Customer Information:
${JSON.stringify(customerInfo, null, 2)}

Items/Services:
${JSON.stringify(items, null, 2)}

Additional Notes:
${additionalNotes || 'None'}

Please generate:
1. A professional invoice description for each item
2. Appropriate tax calculations (if applicable)
3. Professional invoice terms and conditions
4. A thank you message

Format the response as JSON with the following structure:
{
  "invoiceNumber": "INV-YYYY-XXXXX",
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "items": [
    {
      "description": "Professional description",
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "subtotal": number,
  "tax": number,
  "total": number,
  "terms": "Payment terms",
  "thankYouMessage": "Professional thank you message"
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional invoice generation assistant. Generate accurate, professional invoices with proper formatting and calculations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Try to parse JSON response
    let invoiceData;
    try {
      invoiceData = JSON.parse(aiResponse);
    } catch (parseError) {
      // If JSON parsing fails, create a structured response
      invoiceData = {
        invoiceNumber: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: items.map(item => ({
          description: item.description || item.name || 'Service/Product',
          quantity: item.quantity || 1,
          unitPrice: item.price || item.unitPrice || 0,
          total: (item.quantity || 1) * (item.price || item.unitPrice || 0)
        })),
        aiGeneratedContent: aiResponse
      };
    }

    // Calculate totals if not provided
    if (!invoiceData.subtotal || !invoiceData.total) {
      const subtotal = invoiceData.items.reduce((sum, item) => sum + (item.total || 0), 0);
      invoiceData.subtotal = subtotal;
      invoiceData.tax = subtotal * 0.1; // 10% tax as example
      invoiceData.total = subtotal + invoiceData.tax;
    }

    // Add to database
    const invoice = {
      id: database.invoices.length + 1,
      ...invoiceData,
      customerInfo,
      businessInfo: businessInfo || {
        name: 'Your Business Name',
        address: 'Your Business Address',
        email: 'contact@yourbusiness.com',
        phone: '+1-234-567-8900'
      },
      createdAt: new Date().toISOString(),
      status: 'generated'
    };

    database.invoices.push(invoice);

    res.json({
      success: true,
      message: 'Invoice generated successfully',
      invoice: invoice
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: config.isDevelopment ? error.message : 'Internal server error'
    });
  }
});

// Get all invoices
app.get('/api/invoices', (req, res) => {
  res.json({
    success: true,
    invoices: database.invoices
  });
});

// Get specific invoice
app.get('/api/invoices/:id', (req, res) => {
  const invoiceId = parseInt(req.params.id);
  const invoice = database.invoices.find(inv => inv.id === invoiceId);
  
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found'
    });
  }
  
  res.json({
    success: true,
    invoice: invoice
  });
});

// Main page with invoice generation form
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Invoice Generator</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header h1 { color: #333; margin-bottom: 10px; }
        .header p { color: #666; }
        .form-container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .form-section { margin-bottom: 25px; }
        .form-section h3 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
        .form-row { display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; }
        .form-group { flex: 1; min-width: 200px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        .form-group input, .form-group textarea, .form-group select { 
          width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px;
        }
        .form-group textarea { height: 80px; resize: vertical; }
        .items-section { border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
        .item-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: end; flex-wrap: wrap; }
        .item-row .form-group { min-width: 150px; }
        .btn { background: #007bff; color: white; padding: 12px 25px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; text-decoration: none; display: inline-block; }
        .btn:hover { background: #0056b3; }
        .btn-secondary { background: #6c757d; }
        .btn-secondary:hover { background: #545b62; }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #1e7e34; }
        .status-bar { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .status-item { display: inline-block; margin-right: 20px; }
        .status-active { color: #28a745; font-weight: bold; }
        .status-inactive { color: #dc3545; font-weight: bold; }
        .invoice-result { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-top: 20px; display: none; }
        .loading { text-align: center; padding: 40px; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .alert { padding: 15px; margin-bottom: 20px; border: 1px solid transparent; border-radius: 5px; }
        .alert-success { color: #155724; background-color: #d4edda; border-color: #c3e6cb; }
        .alert-error { color: #721c24; background-color: #f8d7da; border-color: #f5c6cb; }
        @media (max-width: 768px) { .form-row { flex-direction: column; } .item-row { flex-direction: column; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 AI Invoice Generator</h1>
          <p>Generate professional invoices with AI assistance powered by OpenAI</p>
        </div>

        <div class="status-bar">
          <div class="status-item">
            AI Service: <span class="${hasOpenAI ? 'status-active' : 'status-inactive'}">${hasOpenAI ? 'Active' : 'Disabled - Missing API Key'}</span>
          </div>
          <div class="status-item">
            Environment: <span class="status-active">${config.isProduction ? 'Production' : 'Development'}</span>
          </div>
          <div class="status-item">
            Server: <span class="status-active">Vercel Serverless</span>
          </div>
        </div>

        <div class="form-container">
          <form id="invoiceForm">
            <div class="form-section">
              <h3>👤 Customer Information</h3>
              <div class="form-row">
                <div class="form-group">
                  <label>Customer Name *</label>
                  <input type="text" id="customerName" required>
                </div>
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" id="customerEmail">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Phone</label>
                  <input type="text" id="customerPhone">
                </div>
                <div class="form-group">
                  <label>Company</label>
                  <input type="text" id="customerCompany">
                </div>
              </div>
              <div class="form-group">
                <label>Address</label>
                <textarea id="customerAddress" placeholder="Enter customer address..."></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3>🏢 Business Information (Optional)</h3>
              <div class="form-row">
                <div class="form-group">
                  <label>Business Name</label>
                  <input type="text" id="businessName" placeholder="Your Business Name">
                </div>
                <div class="form-group">
                  <label>Business Email</label>
                  <input type="email" id="businessEmail" placeholder="contact@yourbusiness.com">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Phone</label>
                  <input type="text" id="businessPhone" placeholder="+1-234-567-8900">
                </div>
                <div class="form-group">
                  <label>Website</label>
                  <input type="text" id="businessWebsite" placeholder="https://yourbusiness.com">
                </div>
              </div>
              <div class="form-group">
                <label>Business Address</label>
                <textarea id="businessAddress" placeholder="Your business address..."></textarea>
              </div>
            </div>

            <div class="form-section">
              <h3>📋 Invoice Items</h3>
              <div class="items-section" id="itemsContainer">
                <div class="item-row">
                  <div class="form-group">
                    <label>Description *</label>
                    <input type="text" name="itemDescription" placeholder="Product/Service description" required>
                  </div>
                  <div class="form-group">
                    <label>Quantity *</label>
                    <input type="number" name="itemQuantity" min="1" value="1" required>
                  </div>
                  <div class="form-group">
                    <label>Unit Price *</label>
                    <input type="number" name="itemPrice" min="0" step="0.01" placeholder="0.00" required>
                  </div>
                  <div class="form-group">
                    <label>&nbsp;</label>
                    <button type="button" class="btn btn-secondary" onclick="removeItem(this)">Remove</button>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-secondary" onclick="addItem()">+ Add Item</button>
            </div>

            <div class="form-section">
              <h3>📝 Additional Notes</h3>
              <div class="form-group">
                <textarea id="additionalNotes" placeholder="Any additional notes or special instructions..."></textarea>
              </div>
            </div>

            <div class="form-section">
              <button type="submit" class="btn btn-success" ${!hasOpenAI ? 'disabled' : ''}>
                🤖 Generate Invoice with AI
              </button>
              ${!hasOpenAI ? '<p style="color: red; margin-top: 10px;">AI service is not available. Please configure OpenAI API key.</p>' : ''}
            </div>
          </form>
        </div>

        <div id="loadingDiv" class="loading" style="display: none;">
          <div class="spinner"></div>
          <p>AI is generating your professional invoice...</p>
        </div>

        <div id="invoiceResult" class="invoice-result">
          <!-- Invoice result will be displayed here -->
        </div>

        <div class="form-container">
          <h3>📄 Recent Invoices</h3>
          <div id="invoicesList">
            <p>No invoices generated yet. Create your first invoice above!</p>
          </div>
          <button type="button" class="btn btn-secondary" onclick="loadInvoices()">Refresh</button>
        </div>
      </div>

      <script>
        let itemCounter = 1;

        function addItem() {
          const container = document.getElementById('itemsContainer');
          const newItem = document.createElement('div');
          newItem.className = 'item-row';
          newItem.innerHTML = \`
            <div class="form-group">
              <label>Description *</label>
              <input type="text" name="itemDescription" placeholder="Product/Service description" required>
            </div>
            <div class="form-group">
              <label>Quantity *</label>
              <input type="number" name="itemQuantity" min="1" value="1" required>
            </div>
            <div class="form-group">
              <label>Unit Price *</label>
              <input type="number" name="itemPrice" min="0" step="0.01" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label>&nbsp;</label>
              <button type="button" class="btn btn-secondary" onclick="removeItem(this)">Remove</button>
            </div>
          \`;
          container.appendChild(newItem);
        }

        function removeItem(button) {
          const container = document.getElementById('itemsContainer');
          if (container.children.length > 1) {
            button.closest('.item-row').remove();
          }
        }

        function showAlert(message, type = 'error') {
          const existingAlert = document.querySelector('.alert');
          if (existingAlert) existingAlert.remove();
          
          const alert = document.createElement('div');
          alert.className = \`alert alert-\${type}\`;
          alert.textContent = message;
          
          const container = document.querySelector('.container');
          container.insertBefore(alert, container.firstChild);
          
          setTimeout(() => alert.remove(), 5000);
        }

        document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const loadingDiv = document.getElementById('loadingDiv');
          const resultDiv = document.getElementById('invoiceResult');
          
          // Collect form data
          const customerInfo = {
            name: document.getElementById('customerName').value,
            email: document.getElementById('customerEmail').value,
            phone: document.getElementById('customerPhone').value,
            company: document.getElementById('customerCompany').value,
            address: document.getElementById('customerAddress').value
          };

          const businessInfo = {
            name: document.getElementById('businessName').value || 'Your Business Name',
            email: document.getElementById('businessEmail').value || 'contact@yourbusiness.com',
            phone: document.getElementById('businessPhone').value || '+1-234-567-8900',
            website: document.getElementById('businessWebsite').value || 'https://yourbusiness.com',
            address: document.getElementById('businessAddress').value || 'Your Business Address'
          };

          const items = [];
          const itemRows = document.querySelectorAll('.item-row');
          itemRows.forEach(row => {
            const description = row.querySelector('[name="itemDescription"]').value;
            const quantity = parseInt(row.querySelector('[name="itemQuantity"]').value);
            const price = parseFloat(row.querySelector('[name="itemPrice"]').value);
            
            if (description && quantity && price) {
              items.push({ description, quantity, price });
            }
          });

          const additionalNotes = document.getElementById('additionalNotes').value;

          if (!customerInfo.name || items.length === 0) {
            showAlert('Please fill in customer name and at least one item.');
            return;
          }

          // Show loading
          loadingDiv.style.display = 'block';
          resultDiv.style.display = 'none';

          try {
            const response = await fetch('/api/generate-invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerInfo,
                items,
                businessInfo,
                additionalNotes
              })
            });

            const result = await response.json();

            if (result.success) {
              showAlert('Invoice generated successfully!', 'success');
              displayInvoice(result.invoice);
              loadInvoices(); // Refresh invoice list
              document.getElementById('invoiceForm').reset(); // Clear form
            } else {
              showAlert(result.message || 'Failed to generate invoice');
            }
          } catch (error) {
            showAlert('Error generating invoice: ' + error.message);
          } finally {
            loadingDiv.style.display = 'none';
          }
        });

        function displayInvoice(invoice) {
          const resultDiv = document.getElementById('invoiceResult');
          resultDiv.innerHTML = \`
            <h2>📄 Generated Invoice</h2>
            <div style="border: 1px solid #ddd; padding: 20px; border-radius: 5px; background: #f9f9f9;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
                <div>
                  <h3>\${invoice.businessInfo.name}</h3>
                  <p>\${invoice.businessInfo.address}</p>
                  <p>Email: \${invoice.businessInfo.email}</p>
                  <p>Phone: \${invoice.businessInfo.phone}</p>
                </div>
                <div style="text-align: right;">
                  <h3>INVOICE</h3>
                  <p><strong>Invoice #:</strong> \${invoice.invoiceNumber}</p>
                  <p><strong>Date:</strong> \${invoice.date}</p>
                  <p><strong>Due Date:</strong> \${invoice.dueDate}</p>
                </div>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h4>Bill To:</h4>
                <p><strong>\${invoice.customerInfo.name}</strong></p>
                \${invoice.customerInfo.company ? \`<p>\${invoice.customerInfo.company}</p>\` : ''}
                \${invoice.customerInfo.address ? \`<p>\${invoice.customerInfo.address}</p>\` : ''}
                \${invoice.customerInfo.email ? \`<p>Email: \${invoice.customerInfo.email}</p>\` : ''}
                \${invoice.customerInfo.phone ? \`<p>Phone: \${invoice.customerInfo.phone}</p>\` : ''}
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Quantity</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Unit Price</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  \${invoice.items.map(item => \`
                    <tr>
                      <td style="padding: 10px; border: 1px solid #ddd;">\${item.description}</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">\${item.quantity}</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$\${item.unitPrice.toFixed(2)}</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$\${item.total.toFixed(2)}</td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>

              <div style="text-align: right; margin-bottom: 20px;">
                <p><strong>Subtotal: $\${invoice.subtotal.toFixed(2)}</strong></p>
                <p><strong>Tax: $\${invoice.tax.toFixed(2)}</strong></p>
                <h3><strong>Total: $\${invoice.total.toFixed(2)}</strong></h3>
              </div>

              \${invoice.terms ? \`<div style="margin-bottom: 15px;"><strong>Terms:</strong> \${invoice.terms}</div>\` : ''}
              \${invoice.thankYouMessage ? \`<div><strong>Thank You Message:</strong> \${invoice.thankYouMessage}</div>\` : ''}
            </div>
          \`;
          resultDiv.style.display = 'block';
        }

        async function loadInvoices() {
          try {
            const response = await fetch('/api/invoices');
            const result = await response.json();
            
            const invoicesDiv = document.getElementById('invoicesList');
            
            if (result.success && result.invoices.length > 0) {
              invoicesDiv.innerHTML = result.invoices.map(invoice => \`
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong>\${invoice.invoiceNumber}</strong> - \${invoice.customerInfo.name}
                      <br><small>Created: \${new Date(invoice.createdAt).toLocaleString()}</small>
                    </div>
                    <div>
                      <strong>$\${invoice.total.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              \`).join('');
            } else {
              invoicesDiv.innerHTML = '<p>No invoices generated yet. Create your first invoice above!</p>';
            }
          } catch (error) {
            console.error('Error loading invoices:', error);
          }
        }

        // Load invoices on page load
        loadInvoices();
      </script>
    </body>
    </html>
  `);
});

// Auth routes (simplified for demo)
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    // Simple demo login (replace with real authentication)
    if (username === 'demo' && password === 'demo123') {
      res.json({
        success: true,
        message: 'Login successful',
        user: { username: 'demo', email: 'demo@example.com' }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during login' 
    });
  }
});

app.get('/auth/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - AI Invoice Generator</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; }
        input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
        .header { text-align: center; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🔐 Login</h2>
        <p>Access your AI Invoice Generator</p>
      </div>
      
      <form id="loginForm">
        <div class="form-group">
          <label>Username:</label>
          <input type="text" id="username" value="demo" required>
        </div>
        <div class="form-group">
          <label>Password:</label>
          <input type="password" id="password" value="demo123" required>
        </div>
        <button type="submit">Login</button>
      </form>
      
      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          
          try {
            const response = await fetch('/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Login successful!');
              window.location.href = '/';
            } else {
              alert('Error: ' + result.message);
            }
          } catch (error) {
            alert('Login failed: ' + error.message);
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  res.status(500).json({
    success: false,
    message: config.isDevelopment ? error.message : 'Internal server error',
    ...(config.isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Export the app for Vercel
export default app;
