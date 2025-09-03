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

// Main page with original Indonesian purple-themed interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Aspree Invoice Generator - Modern Purple</title>
        <style>
        /* Modern Purple Design System */
        :root {
            /* Primary Purple Palette - Updated to match invoice */
            --primary-purple: #311d6b;
            --primary-dark: #2a1759;
            --primary-light: #4a2b7a;
            
            /* Secondary/Accent Colors */
            --accent-purple: #4a2b7a;
            --light-accent: #6d5498;
            --deep-purple: #241347;
            
            /* Neutral Colors */
            --background: #FAFAFA;
            --card-background: #FFFFFF;
            --text-primary: #2D3748;
            --text-secondary: #718096;
            --border-color: #E2E8F0;
            
            /* Status Colors */
            --success: #48BB78;
            --warning: #ED8936;
            --error: #F56565;
            --info: #4299E1;
            --whatsapp: #25D366;
            --disabled-grey: #9CA3AF;
            
            /* Component Specific */
            --shadow-soft: 0 4px 6px rgba(49, 29, 107, 0.05);
            --shadow-medium: 0 10px 25px rgba(49, 29, 107, 0.1);
            --shadow-strong: 0 20px 40px rgba(49, 29, 107, 0.15);
            --gradient-primary: linear-gradient(135deg, #311d6b, #4a2b7a);
            --gradient-card: linear-gradient(145deg, #FFFFFF 0%, #F8F9FF 100%);
            --border-radius: 12px;
            --border-radius-large: 16px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: var(--background);
            color: var(--text-primary);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* Header */
        .header {
            background: var(--gradient-primary);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding: 16px 0;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(8px);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 24px;
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 20px;
            font-weight: 700;
            color: white;
            text-decoration: none;
            margin-left: 8px;
            transition: var(--transition);
            border-radius: 8px;
            padding: 4px;
        }
        
        .logo:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .profile-btn {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            text-decoration: none;
        }

        .profile-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
        }

        /* Main Content */
        .main {
            padding: 40px 0;
        }

        .page-header {
            text-align: center;
            margin-bottom: 48px;
        }

        .page-title {
            font-size: 48px;
            font-weight: 800;
            margin-bottom: 16px;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .page-subtitle {
            font-size: 18px;
            color: var(--text-secondary);
            max-width: 600px;
            margin: 0 auto;
        }

        /* Business Profile */
        .business-profile {
            background: var(--gradient-card);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-large);
            padding: 32px;
            margin-bottom: 32px;
            box-shadow: var(--shadow-medium);
        }

        .profile-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }

        .profile-header h3 {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .edit-btn {
            background: rgba(74, 43, 122, 0.1);
            color: var(--primary-purple);
            border: 1px solid rgba(74, 43, 122, 0.2);
            border-radius: 8px;
            padding: 8px 16px;
            font-weight: 600;
            text-decoration: none;
            transition: var(--transition);
        }

        .edit-btn:hover {
            background: rgba(74, 43, 122, 0.15);
        }

        /* Generator Section */
        .generator-section {
            display: grid;
            grid-template-columns: 1fr;
            gap: 32px;
            margin-bottom: 32px;
        }

        .generator-card {
            background: var(--gradient-card);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-large);
            padding: 32px;
            box-shadow: var(--shadow-medium);
        }

        .generator-input-section {
            margin-bottom: 32px;
        }

        .input-header h3 {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .input-header p {
            color: var(--text-secondary);
            margin-bottom: 24px;
        }

        .generator-textarea {
            width: 100%;
            min-height: 120px;
            padding: 16px;
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius);
            font-family: inherit;
            font-size: 14px;
            line-height: 1.5;
            resize: vertical;
            transition: var(--transition);
        }

        .generator-textarea:focus {
            outline: none;
            border-color: var(--primary-purple);
            box-shadow: 0 0 0 3px rgba(49, 29, 107, 0.1);
        }

        .generator-actions {
            display: flex;
            gap: 16px;
            margin-top: 16px;
        }

        .generate-btn {
            background: var(--gradient-primary);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            padding: 16px 32px;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .generate-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: var(--shadow-strong);
        }

        .generate-btn:disabled {
            background: var(--disabled-grey);
            cursor: not-allowed;
        }

        .clear-btn {
            background: transparent;
            color: var(--text-secondary);
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 16px 24px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .clear-btn:hover {
            border-color: var(--error);
            color: var(--error);
        }

        /* Status Bar */
        .status-bar {
            background: var(--gradient-card);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 16px 24px;
            margin-bottom: 24px;
            display: flex;
            gap: 32px;
            align-items: center;
            flex-wrap: wrap;
        }

        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
        }

        .status-active {
            color: var(--success);
        }

        .status-inactive {
            color: var(--error);
        }

        /* Loading and Results */
        .loading {
            text-align: center;
            padding: 40px;
        }

        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--border-color);
            border-top: 3px solid var(--primary-purple);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .generator-output-section {
            margin-top: 32px;
        }

        .output-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }

        .output-header h3 {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .confirm-btn {
            background: var(--success);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            padding: 12px 24px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .confirm-btn:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-medium);
        }

        .pdf-preview-container {
            background: #f5f5f5;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            min-height: 600px;
            position: relative;
            overflow: auto;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 20px;
        }

        .pdf-preview {
            width: 100%;
            max-width: 800px;
            background: white;
            box-shadow: var(--shadow-medium);
            border-radius: var(--border-radius);
            padding: 40px;
            margin: 0 auto;
        }

        /* Alert Messages */
        .alert {
            padding: 16px;
            border-radius: var(--border-radius);
            margin-bottom: 16px;
            font-weight: 600;
        }

        .alert-success {
            background-color: rgba(72, 187, 120, 0.1);
            color: var(--success);
            border: 1px solid rgba(72, 187, 120, 0.2);
        }

        .alert-error {
            background-color: rgba(245, 101, 101, 0.1);
            color: var(--error);
            border: 1px solid rgba(245, 101, 101, 0.2);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .container {
                padding: 0 16px;
            }

            .page-title {
                font-size: 32px;
            }

            .generator-actions {
                flex-direction: column;
            }

            .status-bar {
                flex-direction: column;
                align-items: flex-start;
                gap: 16px;
            }
        }
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
