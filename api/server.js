import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic configuration for Vercel serverless
const config = {
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  merchant: {
    businessName: process.env.MERCHANT_NAME || 'Toko Gadget Teknologi',
    email: process.env.MERCHANT_EMAIL || 'billing@tokogadget.co.id',
    address: process.env.MERCHANT_ADDRESS || 'Jl. Teknologi No. 123, Jakarta Selatan, DKI Jakarta 12345',
    phone: process.env.MERCHANT_PHONE || '+62 21 1234 5678',
    website: process.env.MERCHANT_WEBSITE || 'https://tokogadget.co.id',
    taxId: process.env.MERCHANT_TAX_ID || '01.123.456.7-123.000',
    taxEnabled: process.env.MERCHANT_TAX_ENABLED === 'true' || true,
    taxRate: parseFloat(process.env.MERCHANT_TAX_RATE) || 11
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  }
};

// Performance optimization: In-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache helper functions
const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// Performance metrics
const performanceMetrics = {
  requests: { total: 0, successful: 0, failed: 0 }
};

// Simple database simulation
const database = {
  merchants: [],
  invoices: [],
  customers: [],
  products: [
    {
      id: "prod_001",
      name: "iPhone 15 Pro",
      description: "Latest iPhone with Pro features",
      price: 16500000,
      category: "Smartphones"
    },
    {
      id: "prod_002", 
      name: "Samsung Galaxy S24",
      description: "Premium Android smartphone",
      price: 14800000,
      category: "Smartphones"
    },
    {
      id: "prod_003",
      name: "AirPods Pro", 
      description: "Wireless earbuds with noise cancellation",
      price: 4100000,
      category: "Audio"
    }
  ],
  orders: [],
  settings: {},
  
  // Database methods
  async getBusinessSettings() {
    return this.settings;
  },
  
  async saveMerchant(merchantData) {
    const merchant = {
      id: Date.now().toString(),
      ...merchantData,
      createdAt: new Date().toISOString()
    };
    this.merchants.push(merchant);
    return merchant;
  },
  
  async findMerchantByEmail(email) {
    return this.merchants.find(m => m.email === email);
  },
  
  async saveInvoice(invoiceData) {
    const invoice = {
      id: this.invoices.length + 1,
      ...invoiceData,
      createdAt: new Date().toISOString()
    };
    this.invoices.push(invoice);
    return invoice;
  },
  
  async getInvoices() {
    return this.invoices;
  },
  
  async getProducts() {
    return this.products;
  },
  
  async getCustomers() {
    return this.customers;
  }
};

// Simple auth service
const authService = {
  async registerMerchant({ fullName, businessName, email, password }) {
    // Check if merchant already exists
    const existingMerchant = await database.findMerchantByEmail(email);
    if (existingMerchant) {
      return { success: false, error: 'Email sudah terdaftar' };
    }
    
    const merchant = await database.saveMerchant({
      fullName, businessName, email, password
    });
    
    return { 
      success: true, 
      message: 'Merchant berhasil didaftarkan',
      merchant: { id: merchant.id, fullName, businessName, email }
    };
  },
  
  async loginMerchant(email, password) {
    const merchant = await database.findMerchantByEmail(email);
    if (!merchant || merchant.password !== password) {
      return { success: false, error: 'Email atau password salah' };
    }
    
    return {
      success: true,
      message: 'Login berhasil',
      merchant: { id: merchant.id, fullName: merchant.fullName, businessName: merchant.businessName, email }
    };
  }
};

// Initialize OpenAI
let openai = null;
const hasOpenAI = !!process.env.OPENAI_API_KEY;

if (hasOpenAI) {
  try {
    const { default: OpenAI } = await import('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI initialized successfully');
  } catch (error) {
    console.error('❌ OpenAI initialization failed:', error.message);
  }
}

// Middleware setup
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

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
  message: 'Terlalu banyak request, coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

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

// Authentication middleware
const authenticateMerchant = (req, res, next) => {
  // Simple demo authentication - in production use proper JWT
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (token && token === 'demo-token') {
    req.merchant = { id: '1', email: 'demo@aspree.co.id', businessName: 'Demo Business' };
    return next();
  }
  
  res.status(401).json({ success: false, message: 'Unauthorized' });
};

const optionalAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (token && token === 'demo-token') {
    req.merchant = { id: '1', email: 'demo@aspree.co.id', businessName: 'Demo Business' };
  }
  next();
};

// Serve static files (favicon handling)
app.use('/favicon.ico', (req, res) => res.status(204).end());

// ==========================================
// MAIN ROUTES (Based on original web-server.js)
// ==========================================

// Main page - redirect to login if not authenticated
app.get('/', optionalAuth, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  // If authenticated, redirect to merchant dashboard
  if (req.merchant) {
    return res.redirect('/merchant');
  }
  
  // Otherwise, redirect to login
  res.redirect('/auth/login');
});

// Serve the main invoice generator interface (Protected)
app.get('/generator', authenticateMerchant, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  // Send the Indonesian invoice interface directly as HTML
  res.send(\`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Aspree Invoice Generator - Modern Purple</title>
        <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
        <link rel="alternate icon" href="/assets/favicon.ico">
        <style>
        /* Complete original Indonesian purple CSS */
        :root {
            --primary-purple: #311d6b;
            --primary-dark: #2a1759;
            --primary-light: #4a2b7a;
            --accent-purple: #4a2b7a;
            --light-accent: #6d5498;
            --deep-purple: #241347;
            --background: #FAFAFA;
            --card-background: #FFFFFF;
            --text-primary: #2D3748;
            --text-secondary: #718096;
            --border-color: #E2E8F0;
            --success: #48BB78;
            --warning: #ED8936;
            --error: #F56565;
            --info: #4299E1;
            --whatsapp: #25D366;
            --disabled-grey: #9CA3AF;
            --shadow-soft: 0 4px 6px rgba(49, 29, 107, 0.05);
            --shadow-medium: 0 10px 25px rgba(49, 29, 107, 0.1);
            --shadow-strong: 0 20px 40px rgba(49, 29, 107, 0.15);
            --gradient-primary: linear-gradient(135deg, #311d6b, #4a2b7a);
            --gradient-card: linear-gradient(145deg, #FFFFFF 0%, #F8F9FF 100%);
            --border-radius: 12px;
            --border-radius-large: 16px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: var(--background);
            color: var(--text-primary);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

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

        .main { padding: 40px 0; }

        .page-header { text-align: center; margin-bottom: 48px; }

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

        .generator-input-section { margin-bottom: 32px; }

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

        .generator-output-section { margin-top: 32px; }

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

        @media (max-width: 768px) {
            .container { padding: 0 16px; }
            .page-title { font-size: 32px; }
            .generator-actions { flex-direction: column; }
        }
        </style>
    </head>
    <body>
        <!-- Header -->
        <header class="header">
            <div class="container">
                <div class="header-content">
                    <a href="/generator" class="logo" title="Aspree Invoice Generator - Home">
                        <div class="logo-icon">🏠</div>
                        <span>Aspree Invoice Generator</span>
                    </a>
                    <div class="header-actions">
                        <a href="/merchant" class="profile-btn">
                            <span>📊</span>
                            <span>Merchant Dashboard</span>
                        </a>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="main">
            <div class="container">
                <!-- Page Header -->
                <div class="page-header">
                    <h1 class="page-title">Aspree Invoice Generator</h1>
                    <p class="page-subtitle">
                        Create professional invoices instantly with AI. Just describe your order in natural language, and let our intelligent system handle the rest.
                    </p>
                </div>

                <!-- Business Profile Card -->
                <div class="business-profile">
                    <div class="profile-header">
                        <div class="profile-info">
                            <h3>Business Information</h3>
                        </div>
                        <a href="#" class="edit-btn" onclick="alert('Business settings coming soon!')">
                            <span>⚙️</span>
                            Settings
                        </a>
                    </div>
                </div>

                <!-- Generator Section -->
                <div class="generator-section">
                    <div class="generator-card">
                        <!-- Input Section -->
                        <div class="generator-input-section">
                            <div class="input-header">
                                <h3>✨ Copas Format Pesanan Anda</h3>
                                <p>kami akan membuatkan Faktur Proffesional segera untuk anda.</p>
                            </div>
                            
                            <div class="input-area">
                                <div class="input-wrapper">
                                    <label for="invoice-description" class="input-label">Deskripsi Pesanan</label>
                                    <textarea 
                                        id="invoice-description" 
                                        class="generator-textarea"
                                        placeholder="Contoh: 'Buat faktur untuk Ahmad Rahman (ahmad@email.com) untuk 2 iPhone 15 Pro masing-masing 16.5 juta dan 1 AirPods Pro 4.1 juta'"
                                        rows="4"
                                        oninput="toggleGenerateButton()"
                                    ></textarea>
                                </div>
                                
                                <div class="generator-actions">
                                    <button class="generate-btn" onclick="generateInvoice()" id="generate-btn" \${!hasOpenAI ? 'disabled' : ''}>
                                        <span class="btn-icon">🚀</span>
                                        <span class="btn-text">Buat Faktur</span>
                                        <span class="btn-spinner" style="display: none;">⏳</span>
                                    </button>
                                    <button class="clear-btn" onclick="clearInput()">
                                        <span>🗑️</span>
                                        <span>Clear</span>
                                    </button>
                                </div>
                                \${!hasOpenAI ? '<p style="color: var(--error); margin-top: 16px; font-weight: 600;">❌ AI service tidak tersedia. Silakan konfigurasi OpenAI API key.</p>' : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Output Section -->
                <div class="generator-output-section" id="output-section" style="display: none;">
                    <div class="output-header">
                        <h3 id="output-section-title">🔍 Preview Faktur</h3>
                        <div class="output-actions" id="preview-actions">
                            <button class="confirm-btn" onclick="generateFinalInvoice()">
                                <span>✅</span>
                                <span>Generate Final Invoice</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- PDF Preview -->
                    <div class="pdf-preview-container">
                        <div class="pdf-preview" id="pdf-preview">
                            <div id="loadingDiv" class="loading" style="display: none;">
                                <div class="loading-spinner"></div>
                                <div>AI sedang membuat faktur profesional Anda...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Invoices -->
                <div class="generator-card" style="margin-top: 32px;">
                    <h3>📄 Recent Invoices</h3>
                    <div id="invoicesList" style="margin-top: 16px;">
                        <p>Belum ada faktur yang dibuat. Buat faktur pertama Anda di atas!</p>
                    </div>
                    <button type="button" class="clear-btn" onclick="loadInvoices()" style="margin-top: 16px;">Refresh</button>
                </div>
            </div>
        </main>

        <script>
        function toggleGenerateButton() {
            const textarea = document.getElementById('invoice-description');
            const generateBtn = document.getElementById('generate-btn');
            
            if (textarea.value.trim().length > 0 && \${hasOpenAI}) {
                generateBtn.disabled = false;
            } else {
                generateBtn.disabled = true;
            }
        }

        function clearInput() {
            document.getElementById('invoice-description').value = '';
            toggleGenerateButton();
            
            const outputSection = document.getElementById('output-section');
            outputSection.style.display = 'none';
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

        async function generateInvoice() {
            const textarea = document.getElementById('invoice-description');
            const description = textarea.value.trim();
            
            if (!description) {
                showAlert('Silakan masukkan deskripsi pesanan terlebih dahulu.');
                return;
            }

            if (!\${hasOpenAI}) {
                showAlert('AI service tidak tersedia. Silakan konfigurasi OpenAI API key.');
                return;
            }

            const generateBtn = document.getElementById('generate-btn');
            const btnText = generateBtn.querySelector('.btn-text');
            const btnSpinner = generateBtn.querySelector('.btn-spinner');
            const loadingDiv = document.getElementById('loadingDiv');
            const outputSection = document.getElementById('output-section');
            
            generateBtn.disabled = true;
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline';
            loadingDiv.style.display = 'block';
            outputSection.style.display = 'block';

            try {
                const response = await fetch('/api/generate-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: description,
                        customerInfo: { name: 'Customer from Description' },
                        items: [{ description: 'Parsed from description', quantity: 1, price: 0 }],
                        additionalNotes: description
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showAlert('Faktur berhasil dibuat!', 'success');
                    displayInvoicePreview(result.invoice);
                    loadInvoices();
                } else {
                    showAlert(result.message || 'Gagal membuat faktur');
                }
            } catch (error) {
                showAlert('Error: ' + error.message);
            } finally {
                generateBtn.disabled = false;
                btnText.style.display = 'inline';
                btnSpinner.style.display = 'none';
                loadingDiv.style.display = 'none';
            }
        }

        function displayInvoicePreview(invoice) {
            const pdfPreview = document.getElementById('pdf-preview');
            
            pdfPreview.innerHTML = \`
                <div style="max-width: 800px; margin: 0 auto; font-family: 'Inter', sans-serif; color: #333;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid var(--primary-purple);">
                        <div>
                            <h2 style="color: var(--primary-purple); font-size: 28px; font-weight: 800; margin-bottom: 8px;">\${invoice.businessInfo?.name || 'Aspree Business'}</h2>
                            <p style="color: var(--text-secondary); margin: 4px 0;">\${invoice.businessInfo?.address || 'Jakarta, Indonesia'}</p>
                            <p style="color: var(--text-secondary); margin: 4px 0;">Email: \${invoice.businessInfo?.email || 'billing@aspree.co.id'}</p>
                            <p style="color: var(--text-secondary); margin: 4px 0;">Phone: \${invoice.businessInfo?.phone || '+62 21 1234 5678'}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: var(--gradient-primary); color: white; padding: 16px 24px; border-radius: 12px; margin-bottom: 16px;">
                                <h3 style="font-size: 24px; font-weight: 700; margin: 0;">FAKTUR</h3>
                            </div>
                            <p style="margin: 4px 0; font-weight: 600;"><strong>Invoice #:</strong> \${invoice.invoiceNumber}</p>
                            <p style="margin: 4px 0; font-weight: 600;"><strong>Tanggal:</strong> \${invoice.date}</p>
                            <p style="margin: 4px 0; font-weight: 600;"><strong>Jatuh Tempo:</strong> \${invoice.dueDate}</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 32px;">
                        <h4 style="color: var(--primary-purple); font-size: 18px; font-weight: 700; margin-bottom: 12px;">Tagihan Untuk:</h4>
                        <div style="background: rgba(74, 43, 122, 0.05); padding: 20px; border-radius: 12px; border-left: 4px solid var(--primary-purple);">
                            <p style="font-weight: 700; font-size: 16px; margin-bottom: 8px;">\${invoice.customerInfo?.name || 'Customer Name'}</p>
                        </div>
                    </div>

                    <div style="margin-bottom: 32px;">
                        <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(49, 29, 107, 0.1);">
                            <thead>
                                <tr style="background: var(--gradient-primary); color: white;">
                                    <th style="padding: 16px; text-align: left; font-weight: 700;">Deskripsi</th>
                                    <th style="padding: 16px; text-align: center; font-weight: 700;">Qty</th>
                                    <th style="padding: 16px; text-align: right; font-weight: 700;">Harga</th>
                                    <th style="padding: 16px; text-align: right; font-weight: 700;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${invoice.items?.map((item, index) => \`
                                    <tr style="background: \${index % 2 === 0 ? 'rgba(74, 43, 122, 0.02)' : 'white'}; border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 16px; font-weight: 600;">\${item.description}</td>
                                        <td style="padding: 16px; text-align: center;">\${item.quantity}</td>
                                        <td style="padding: 16px; text-align: right;">Rp \${(item.unitPrice || 0).toLocaleString('id-ID')}</td>
                                        <td style="padding: 16px; text-align: right; font-weight: 700;">Rp \${(item.total || 0).toLocaleString('id-ID')}</td>
                                    </tr>
                                \`).join('') || '<tr><td colspan="4" style="padding: 16px; text-align: center;">Tidak ada item</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
                        <div style="background: rgba(74, 43, 122, 0.05); padding: 24px; border-radius: 12px; min-width: 300px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-weight: 600;">Subtotal:</span>
                                <span style="font-weight: 600;">Rp \${(invoice.subtotal || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                                <span style="font-weight: 600;">Pajak (11%):</span>
                                <span style="font-weight: 600;">Rp \${(invoice.tax || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-size: 20px; font-weight: 800; color: var(--primary-purple);">TOTAL:</span>
                                <span style="font-size: 20px; font-weight: 800; color: var(--primary-purple);">Rp \${(invoice.total || 0).toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            \`;
        }

        function generateFinalInvoice() {
            showAlert('Final invoice generated! 🎉', 'success');
            document.getElementById('output-section-title').textContent = '✅ Final Faktur';
            document.getElementById('preview-actions').style.display = 'none';
        }

        async function loadInvoices() {
            try {
                const response = await fetch('/api/invoices');
                const result = await response.json();
                
                const invoicesDiv = document.getElementById('invoicesList');
                
                if (result.success && result.invoices.length > 0) {
                    invoicesDiv.innerHTML = result.invoices.map(invoice => \`
                        <div style="border: 1px solid var(--border-color); padding: 20px; margin-bottom: 16px; border-radius: var(--border-radius); background: var(--gradient-card); box-shadow: var(--shadow-soft);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="color: var(--primary-purple); font-size: 16px;">\${invoice.invoiceNumber}</strong>
                                    <span style="color: var(--text-secondary);"> - \${invoice.customerInfo?.name || 'Unknown Customer'}</span>
                                    <br><small style="color: var(--text-secondary);">Dibuat: \${new Date(invoice.createdAt).toLocaleString('id-ID')}</small>
                                </div>
                                <div>
                                    <strong style="color: var(--success); font-size: 18px;">Rp \${(invoice.total || 0).toLocaleString('id-ID')}</strong>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    invoicesDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Belum ada faktur yang dibuat. Buat faktur pertama Anda di atas!</p>';
                }
            } catch (error) {
                console.error('Error loading invoices:', error);
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            loadInvoices();
            toggleGenerateButton();
        });
        </script>
    </body>
    </html>
  \`);
});

// Merchant Dashboard
app.get('/merchant', authenticateMerchant, (req, res) => {
  // Send the Indonesian merchant dashboard directly as HTML
  res.send(\`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Merchant Dashboard - Aspree Invoice Gen</title>
        <style>
        /* Professional Business Design System */
        :root {
            --primary-purple: #2563EB;
            --primary-dark: #1D4ED8;
            --primary-light: #3B82F6;
            --accent-purple: #1E40AF;
            --light-accent: #60A5FA;
            --deep-purple: #1E3A8A;
            --background: #FAFAFA;
            --card-background: #FFFFFF;
            --text-primary: #2D3748;
            --text-secondary: #718096;
            --border-color: #E2E8F0;
            --success: #48BB78;
            --warning: #ED8936;
            --error: #F56565;
            --info: #4299E1;
            --whatsapp: #25D366;
            --shadow-soft: 0 4px 6px rgba(37, 99, 235, 0.05);
            --shadow-medium: 0 10px 25px rgba(37, 99, 235, 0.1);
            --shadow-strong: 0 20px 40px rgba(37, 99, 235, 0.15);
            --gradient-primary: linear-gradient(135deg, var(--primary-purple) 0%, var(--accent-purple) 100%);
            --gradient-card: linear-gradient(145deg, #FFFFFF 0%, #F7F9FF 100%);
            --border-radius: 12px;
            --border-radius-large: 16px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: var(--background);
            color: var(--text-primary);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .header {
            background: linear-gradient(135deg, var(--primary-purple), var(--accent-purple));
            border-bottom: none;
            padding: 16px 0;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(8px);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 24px;
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
        }

        .logo-icon {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
        }

        .header-actions {
            display: flex;
            gap: 16px;
            align-items: center;
        }

        .settings-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            color: white;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            transition: var(--transition);
            backdrop-filter: blur(4px);
        }

        .settings-btn:hover {
            background: rgba(255, 255, 255, 0.25);
            border-color: rgba(255, 255, 255, 0.5);
            color: white;
            transform: translateY(-1px);
            box-shadow: var(--shadow-medium);
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 40px 24px;
        }

        .dashboard-nav {
            display: flex;
            gap: 16px;
            margin-bottom: 32px;
            background: var(--card-background);
            padding: 20px;
            border-radius: var(--border-radius-large);
            box-shadow: var(--shadow-soft);
            border: 1px solid var(--border-color);
        }

        .nav-btn {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: var(--transition);
            text-decoration: none;
            color: var(--text-primary);
            background: var(--background);
            border: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }

        .nav-btn:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-medium);
            background: var(--primary-light);
            color: white;
            border-color: var(--primary-light);
        }

        .nav-btn.active {
            background: var(--gradient-primary);
            color: white;
            border-color: var(--primary-purple);
            box-shadow: var(--shadow-soft);
        }

        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
        }

        .page-title {
            font-size: 32px;
            font-weight: 800;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .section {
            background: var(--gradient-card);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-large);
            padding: 32px;
            margin-bottom: 32px;
            box-shadow: var(--shadow-medium);
            display: none;
        }

        .section.active { display: block; }

        .section h2 {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .section-icon {
            font-size: 28px;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--card-background);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 24px;
            text-align: center;
            box-shadow: var(--shadow-soft);
            transition: var(--transition);
        }

        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-medium);
        }

        .stat-number {
            font-size: 36px;
            font-weight: 800;
            color: var(--primary-purple);
            margin-bottom: 8px;
        }

        .stat-label {
            font-size: 14px;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
            .dashboard-nav {
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .nav-btn {
                flex: 1;
                min-width: calc(50% - 0.25rem);
                padding: 0.75rem 1rem;
                font-size: 0.85rem;
                text-align: center;
            }
        }
        </style>
    </head>
    <body>
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <a href="/merchant" class="logo">
                    <div class="logo-icon">📊</div>
                    <span>Merchant Dashboard</span>
                </a>
                <div class="header-actions">
                    <a href="/generator" class="settings-btn">
                        <span>⚡</span>
                        <span>Invoice Generator</span>
                    </a>
                    <a href="#" class="settings-btn" onclick="alert('Settings coming soon!')">
                        <span>⚙️</span>
                        <span>Settings</span>
                    </a>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <div class="container">
            <div class="page-header">
                <h1 class="page-title">Dashboard Overview</h1>
            </div>

            <!-- Navigation -->
            <div class="dashboard-nav">
                <button class="nav-btn active" onclick="showSection('products')">
                    <span>📦</span> Products
                </button>
                <button class="nav-btn" onclick="showSection('orders')">
                    <span>🛒</span> Orders
                </button>
                <button class="nav-btn" onclick="showSection('invoices')">
                    <span>📄</span> Invoices
                </button>
                <button class="nav-btn" onclick="showSection('customers')">
                    <span>👥</span> Customers
                </button>
            </div>

            <!-- Products Section -->
            <div id="products-section" class="section active">
                <h2>
                    <div class="section-icon">📦</div>
                    Product Catalog
                </h2>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number" id="total-products">0</div>
                        <div class="stat-label">Total Products</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="active-products">0</div>
                        <div class="stat-label">Active Products</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="product-categories">0</div>
                        <div class="stat-label">Categories</div>
                    </div>
                </div>
                
                <div id="products-list">
                    <p style="text-align: center; color: var(--text-secondary); padding: 40px;">Loading products...</p>
                </div>
            </div>

            <!-- Orders Section -->
            <div id="orders-section" class="section">
                <h2>
                    <div class="section-icon">🛒</div>
                    Order Management
                </h2>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number" id="total-orders">0</div>
                        <div class="stat-label">Total Orders</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="pending-orders">0</div>
                        <div class="stat-label">Pending Orders</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="completed-orders">0</div>
                        <div class="stat-label">Completed Orders</div>
                    </div>
                </div>
                
                <div id="orders-list">
                    <p style="text-align: center; color: var(--text-secondary); padding: 40px;">No orders yet.</p>
                </div>
            </div>

            <!-- Invoices Section -->
            <div id="invoices-section" class="section">
                <h2>
                    <div class="section-icon">📄</div>
                    Invoice Management
                </h2>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number" id="total-invoices">0</div>
                        <div class="stat-label">Total Invoices</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="paid-invoices">0</div>
                        <div class="stat-label">Paid Invoices</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="revenue">Rp 0</div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                </div>
                
                <div id="invoices-list">
                    <p style="text-align: center; color: var(--text-secondary); padding: 40px;">Loading invoices...</p>
                </div>
            </div>

            <!-- Customers Section -->
            <div id="customers-section" class="section">
                <h2>
                    <div class="section-icon">👥</div>
                    Customer Management
                </h2>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number" id="total-customers">0</div>
                        <div class="stat-label">Total Customers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="new-customers">0</div>
                        <div class="stat-label">New Customers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="active-customers">0</div>
                        <div class="stat-label">Active Customers</div>
                    </div>
                </div>
                
                <div id="customers-list">
                    <p style="text-align: center; color: var(--text-secondary); padding: 40px;">No customers yet.</p>
                </div>
            </div>
        </div>

        <script>
        function showSection(sectionName) {
            // Hide all sections
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Show selected section
            document.getElementById(sectionName + '-section').classList.add('active');
            
            // Update navigation
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.textContent.toLowerCase().includes(sectionName.toLowerCase())) {
                    btn.classList.add('active');
                }
            });
            
            // Load data for the section
            loadSectionData(sectionName);
        }
        
        async function loadSectionData(section) {
            switch(section) {
                case 'products':
                    await loadProducts();
                    break;
                case 'orders':
                    await loadOrders();
                    break;
                case 'invoices':
                    await loadInvoices();
                    break;
                case 'customers':
                    await loadCustomers();
                    break;
            }
        }
        
        async function loadProducts() {
            try {
                const response = await fetch('/api/products');
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('total-products').textContent = result.products.length;
                    document.getElementById('active-products').textContent = result.products.length;
                    
                    const categories = [...new Set(result.products.map(p => p.category))];
                    document.getElementById('product-categories').textContent = categories.length;
                    
                    const productsList = document.getElementById('products-list');
                    productsList.innerHTML = result.products.map(product => \`
                        <div style="border: 1px solid var(--border-color); padding: 20px; margin-bottom: 16px; border-radius: var(--border-radius); background: var(--card-background);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="color: var(--primary-purple);">\${product.name}</strong>
                                    <p style="color: var(--text-secondary); margin: 4px 0;">\${product.description}</p>
                                    <small style="color: var(--text-secondary);">Category: \${product.category}</small>
                                </div>
                                <div style="text-align: right;">
                                    <strong style="color: var(--success);">Rp \${product.price.toLocaleString('id-ID')}</strong>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    document.getElementById('products-list').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No products found.</p>';
                }
            } catch (error) {
                console.error('Error loading products:', error);
                document.getElementById('products-list').innerHTML = '<p style="text-align: center; color: var(--error); padding: 40px;">Error loading products.</p>';
            }
        }
        
        async function loadOrders() {
            // Placeholder for orders
            document.getElementById('total-orders').textContent = '0';
            document.getElementById('pending-orders').textContent = '0';
            document.getElementById('completed-orders').textContent = '0';
        }
        
        async function loadInvoices() {
            try {
                const response = await fetch('/api/invoices');
                const result = await response.json();
                
                if (result.success && result.invoices.length > 0) {
                    document.getElementById('total-invoices').textContent = result.invoices.length;
                    document.getElementById('paid-invoices').textContent = result.invoices.length;
                    
                    const totalRevenue = result.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
                    document.getElementById('revenue').textContent = 'Rp ' + totalRevenue.toLocaleString('id-ID');
                    
                    const invoicesList = document.getElementById('invoices-list');
                    invoicesList.innerHTML = result.invoices.map(invoice => \`
                        <div style="border: 1px solid var(--border-color); padding: 20px; margin-bottom: 16px; border-radius: var(--border-radius); background: var(--card-background);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="color: var(--primary-purple);">\${invoice.invoiceNumber}</strong>
                                    <p style="color: var(--text-secondary); margin: 4px 0;">Customer: \${invoice.customerInfo?.name || 'Unknown'}</p>
                                    <small style="color: var(--text-secondary);">Created: \${new Date(invoice.createdAt).toLocaleString('id-ID')}</small>
                                </div>
                                <div style="text-align: right;">
                                    <strong style="color: var(--success);">Rp \${(invoice.total || 0).toLocaleString('id-ID')}</strong>
                                    <br><small style="color: var(--success);">Paid</small>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    document.getElementById('invoices-list').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No invoices yet. <a href="/generator">Create your first invoice</a></p>';
                }
            } catch (error) {
                console.error('Error loading invoices:', error);
                document.getElementById('invoices-list').innerHTML = '<p style="text-align: center; color: var(--error); padding: 40px;">Error loading invoices.</p>';
            }
        }
        
        async function loadCustomers() {
            // Placeholder for customers
            document.getElementById('total-customers').textContent = '0';
            document.getElementById('new-customers').textContent = '0';
            document.getElementById('active-customers').textContent = '0';
        }
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            loadSectionData('products');
        });
        </script>
    </body>
    </html>
  \`);
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.get('/auth/login', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - Aspree Invoice Generator</title>
        <style>
        :root {
            --primary-purple: #311d6b;
            --primary-light: #4a2b7a;
            --background: #FAFAFA;
            --card-background: #FFFFFF;
            --text-primary: #2D3748;
            --text-secondary: #718096;
            --border-color: #E2E8F0;
            --error: #F56565;
            --success: #48BB78;
            --gradient-primary: linear-gradient(135deg, #311d6b, #4a2b7a);
            --shadow-medium: 0 10px 25px rgba(49, 29, 107, 0.1);
            --border-radius: 12px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: var(--background);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .login-container {
            background: var(--card-background);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-medium);
            padding: 40px;
            max-width: 400px;
            width: 100%;
        }

        .login-header {
            text-align: center;
            margin-bottom: 32px;
        }

        .login-header h1 {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .login-header p {
            color: var(--text-secondary);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius);
            font-size: 14px;
            transition: var(--transition);
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--primary-purple);
            box-shadow: 0 0 0 3px rgba(49, 29, 107, 0.1);
        }

        .login-btn {
            width: 100%;
            background: var(--gradient-primary);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            padding: 16px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            margin-bottom: 16px;
        }

        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-medium);
        }

        .demo-info {
            background: rgba(72, 187, 120, 0.1);
            border: 1px solid rgba(72, 187, 120, 0.2);
            border-radius: var(--border-radius);
            padding: 16px;
            margin-bottom: 20px;
        }

        .demo-info h4 {
            color: var(--success);
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 600;
        }

        .demo-info p {
            font-size: 12px;
            color: var(--text-secondary);
            margin: 4px 0;
        }

        .register-link {
            text-align: center;
            margin-top: 20px;
        }

        .register-link a {
            color: var(--primary-purple);
            text-decoration: none;
            font-weight: 600;
        }

        .register-link a:hover {
            text-decoration: underline;
        }

        .alert {
            padding: 12px 16px;
            border-radius: var(--border-radius);
            margin-bottom: 16px;
            font-size: 14px;
            font-weight: 600;
        }

        .alert-error {
            background-color: rgba(245, 101, 101, 0.1);
            color: var(--error);
            border: 1px solid rgba(245, 101, 101, 0.2);
        }

        .alert-success {
            background-color: rgba(72, 187, 120, 0.1);
            color: var(--success);
            border: 1px solid rgba(72, 187, 120, 0.2);
        }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="login-header">
                <h1>🔐 Merchant Login</h1>
                <p>Masuk ke Dashboard Anda</p>
            </div>

            <div class="demo-info">
                <h4>✨ Demo Account</h4>
                <p>Username: <strong>demo</strong></p>
                <p>Password: <strong>demo123</strong></p>
            </div>

            <form id="loginForm">
                <div class="form-group">
                    <label for="username">Username/Email:</label>
                    <input type="text" id="username" value="demo" required>
                </div>
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" value="demo123" required>
                </div>
                <button type="submit" class="login-btn">
                    🚀 Masuk ke Dashboard
                </button>
            </form>

            <div class="register-link">
                <p>Belum punya akun? <a href="/auth/register">Daftar di sini</a></p>
            </div>
        </div>

        <script>
        function showAlert(message, type = 'error') {
            const existingAlert = document.querySelector('.alert');
            if (existingAlert) existingAlert.remove();
            
            const alert = document.createElement('div');
            alert.className = \`alert alert-\${type}\`;
            alert.textContent = message;
            
            const form = document.getElementById('loginForm');
            form.parentNode.insertBefore(alert, form);
            
            setTimeout(() => alert.remove(), 5000);
        }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showAlert('Login berhasil! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = '/merchant';
                    }, 1000);
                } else {
                    showAlert(result.message || 'Login gagal');
                }
            } catch (error) {
                showAlert('Error: ' + error.message);
            }
        });
        </script>
    </body>
    </html>
  \`);
});

app.get('/auth/register', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Register - Aspree Invoice Generator</title>
        <style>
        :root {
            --primary-purple: #311d6b;
            --primary-light: #4a2b7a;
            --background: #FAFAFA;
            --card-background: #FFFFFF;
            --text-primary: #2D3748;
            --text-secondary: #718096;
            --border-color: #E2E8F0;
            --error: #F56565;
            --success: #48BB78;
            --gradient-primary: linear-gradient(135deg, #311d6b, #4a2b7a);
            --shadow-medium: 0 10px 25px rgba(49, 29, 107, 0.1);
            --border-radius: 12px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: var(--background);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .register-container {
            background: var(--card-background);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-medium);
            padding: 40px;
            max-width: 400px;
            width: 100%;
        }

        .register-header {
            text-align: center;
            margin-bottom: 32px;
        }

        .register-header h1 {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .register-header p {
            color: var(--text-secondary);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius);
            font-size: 14px;
            transition: var(--transition);
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--primary-purple);
            box-shadow: 0 0 0 3px rgba(49, 29, 107, 0.1);
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
        }

        .checkbox-group input[type="checkbox"] {
            width: auto;
        }

        .register-btn {
            width: 100%;
            background: var(--gradient-primary);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            padding: 16px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            margin-bottom: 16px;
        }

        .register-btn:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-medium);
        }

        .login-link {
            text-align: center;
            margin-top: 20px;
        }

        .login-link a {
            color: var(--primary-purple);
            text-decoration: none;
            font-weight: 600;
        }

        .login-link a:hover {
            text-decoration: underline;
        }

        .alert {
            padding: 12px 16px;
            border-radius: var(--border-radius);
            margin-bottom: 16px;
            font-size: 14px;
            font-weight: 600;
        }

        .alert-error {
            background-color: rgba(245, 101, 101, 0.1);
            color: var(--error);
            border: 1px solid rgba(245, 101, 101, 0.2);
        }

        .alert-success {
            background-color: rgba(72, 187, 120, 0.1);
            color: var(--success);
            border: 1px solid rgba(72, 187, 120, 0.2);
        }
        </style>
    </head>
    <body>
        <div class="register-container">
            <div class="register-header">
                <h1>🚀 Merchant Register</h1>
                <p>Daftar untuk memulai bisnis Anda</p>
            </div>

            <form id="registerForm">
                <div class="form-group">
                    <label for="fullName">Nama Lengkap:</label>
                    <input type="text" id="fullName" required>
                </div>
                <div class="form-group">
                    <label for="businessName">Nama Bisnis:</label>
                    <input type="text" id="businessName" required>
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" required>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="agreeTerms" required>
                    <label for="agreeTerms">Saya setuju dengan syarat dan ketentuan</label>
                </div>
                <button type="submit" class="register-btn">
                    ✨ Daftar Sekarang
                </button>
            </form>

            <div class="login-link">
                <p>Sudah punya akun? <a href="/auth/login">Masuk di sini</a></p>
            </div>
        </div>

        <script>
        function showAlert(message, type = 'error') {
            const existingAlert = document.querySelector('.alert');
            if (existingAlert) existingAlert.remove();
            
            const alert = document.createElement('div');
            alert.className = \`alert alert-\${type}\`;
            alert.textContent = message;
            
            const form = document.getElementById('registerForm');
            form.parentNode.insertBefore(alert, form);
            
            setTimeout(() => alert.remove(), 5000);
        }

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                fullName: document.getElementById('fullName').value,
                businessName: document.getElementById('businessName').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                agreeTerms: document.getElementById('agreeTerms').checked
            };
            
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showAlert('Registrasi berhasil! Silakan login.', 'success');
                    setTimeout(() => {
                        window.location.href = '/auth/login';
                    }, 2000);
                } else {
                    showAlert(result.error || 'Registrasi gagal');
                }
            } catch (error) {
                showAlert('Error: ' + error.message);
            }
        });
        </script>
    </body>
    </html>
  \`);
});

// ==========================================
// API ROUTES
// ==========================================

// Authentication API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Demo login
    if (username === 'demo' && password === 'demo123') {
      res.cookie('token', 'demo-token', {
        httpOnly: true,
        secure: config.isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict'
      });
      
      return res.json({
        success: true,
        message: 'Login berhasil',
        merchant: { id: '1', username: 'demo', email: 'demo@aspree.co.id', businessName: 'Demo Business' }
      });
    }
    
    const result = await authService.loginMerchant(username, password);
    
    if (result.success) {
      res.cookie('token', 'demo-token', {
        httpOnly: true,
        secure: config.isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'strict'
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, businessName, email, password, agreeTerms } = req.body;
    
    if (!agreeTerms) {
      return res.status(400).json({
        success: false,
        error: 'You must agree to the terms and conditions'
      });
    }
    
    const result = await authService.registerMerchant({ fullName, businessName, email, password });
    res.json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

// Invoice generation API
app.post('/api/generate-invoice', async (req, res) => {
  try {
    if (!hasOpenAI || !openai) {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Please check OpenAI API key configuration.'
      });
    }

    const { description, customerInfo, items, additionalNotes } = req.body;

    if (!description && (!customerInfo || !items)) {
      return res.status(400).json({
        success: false,
        message: 'Description or customer information and items are required.'
      });
    }

    // Generate invoice using AI
    const prompt = \`Parse this Indonesian invoice request into structured data:

"\${description || JSON.stringify({customerInfo, items})}"

Extract and generate:
1. Customer information (name, email, company, phone, address)  
2. Items with descriptions, quantities, and prices in Rupiah
3. Professional business terms in Indonesian
4. Thank you message in Indonesian

Respond with valid JSON:
{
  "invoiceNumber": "INV-2024-XXXXX", 
  "date": "2024-XX-XX",
  "dueDate": "2024-XX-XX",
  "customerInfo": {"name": "", "email": "", "phone": "", "company": "", "address": ""},
  "items": [{"description": "", "quantity": 1, "unitPrice": 0, "total": 0}],
  "subtotal": 0,
  "tax": 0, 
  "total": 0,
  "terms": "Indonesian payment terms",
  "thankYouMessage": "Indonesian thank you message"
}\`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional Indonesian invoice generator. Always respond with valid JSON only.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3
    });

    const aiResponse = completion.choices[0].message.content;
    
    let invoiceData;
    try {
      invoiceData = JSON.parse(aiResponse);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      invoiceData = {
        invoiceNumber: \`INV-\${new Date().getFullYear()}-\${Date.now().toString().slice(-5)}\`,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customerInfo: customerInfo || { name: 'Customer dari Deskripsi' },
        items: items || [{ description: 'Item dari deskripsi', quantity: 1, unitPrice: 0, total: 0 }],
        subtotal: 0,
        tax: 0,
        total: 0,
        terms: 'Pembayaran dalam 30 hari',
        thankYouMessage: 'Terima kasih atas kepercayaan Anda!'
      };
    }

    // Save to database
    const savedInvoice = await database.saveInvoice({
      ...invoiceData,
      businessInfo: config.merchant
    });

    res.json({
      success: true,
      message: 'Invoice berhasil dibuat',
      invoice: savedInvoice
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

// Get invoices
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

// Get products
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    products: database.products
  });
});

// Get customers
app.get('/api/customers', (req, res) => {
  res.json({
    success: true,
    customers: database.customers
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
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

export default app;