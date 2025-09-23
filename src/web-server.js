// @ts-nocheck
/* eslint-disable */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import https from 'https';
import http from 'http';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import multer from 'multer';
import config from '../config/config.js';
import SSLManager from './ssl-manager.js';
import WhatsAppInvoiceGenerator from './whatsapp-invoice-generator.js';
// PDF Generator removed - using Print functionality instead
import SupabaseDatabase from './supabase-database.js';
import CloudinaryService from './cloudinary-service.js';
import XenditService from './xendit-service.js';

import SimpleEmailService from './simple-email-service.js';
import AIAutoLearning from './ai-auto-learning.js';
import AuthService from './auth/auth-service.js';
import authMiddleware from './middleware/auth-middleware.js';
// Removed business guidelines import - using simplified single format

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.server.port;

// Trust proxy for Render deployment (fixes X-Forwarded-For header issues)
app.set('trust proxy', 1);

// Performance optimization: In-memory cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache helper functions
const getCacheKey = (prefix, ...args) => `${prefix}:${args.join(':')}`;

const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    performanceMetrics.cacheStats.hits++;
    return cached.data;
  }
  cache.delete(key);
  performanceMetrics.cacheStats.misses++;
  return null;
};

const setCache = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  // Cleanup old cache entries every 100 sets
  if (cache.size % 100 === 0) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
  }
};

// Performance optimization: Async queue for heavy operations
const heavyOperationQueue = [];
let isProcessingQueue = false;

const processHeavyOperations = async () => {
  if (isProcessingQueue || heavyOperationQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (heavyOperationQueue.length > 0) {
    const operation = heavyOperationQueue.shift();
    try {
      await operation();
    } catch (error) {
      console.error('Heavy operation failed:', error);
    }
  }
  
  isProcessingQueue = false;
};

// Schedule heavy operations processing
setInterval(processHeavyOperations, 1000);

// Performance metrics tracking
const performanceMetrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    slow: 0 // requests over 200ms
  },
  averageResponseTime: 0,
  responseTimeHistory: [],
  cacheHitRate: 0,
  cacheStats: {
    hits: 0,
    misses: 0
  }
};

// Update performance metrics
const updatePerformanceMetrics = (duration, successful = true) => {
  performanceMetrics.requests.total++;
  
  if (successful) {
    performanceMetrics.requests.successful++;
  } else {
    performanceMetrics.requests.failed++;
  }
  
  if (duration > 200) {
    performanceMetrics.requests.slow++;
  }
  
  // Keep only last 100 response times for rolling average
  performanceMetrics.responseTimeHistory.push(duration);
  if (performanceMetrics.responseTimeHistory.length > 100) {
    performanceMetrics.responseTimeHistory.shift();
  }
  
  // Calculate average response time
  const sum = performanceMetrics.responseTimeHistory.reduce((a, b) => a + b, 0);
  performanceMetrics.averageResponseTime = Math.round(sum / performanceMetrics.responseTimeHistory.length);
  
  // Calculate cache hit rate
  const totalCacheRequests = performanceMetrics.cacheStats.hits + performanceMetrics.cacheStats.misses;
  if (totalCacheRequests > 0) {
    performanceMetrics.cacheHitRate = Math.round((performanceMetrics.cacheStats.hits / totalCacheRequests) * 100);
  }
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    const successful = res.statusCode < 400;
    
    // Update performance metrics
    if (req.path.startsWith('/api/')) {
      updatePerformanceMetrics(duration, successful);
    }
    
    // Log slow requests (over 200ms for API endpoints)
    if (duration > 200 && req.path.startsWith('/api/')) {
      console.warn(`⚠️  Slow API request: ${req.method} ${route} - ${duration}ms`);
    }
    
    // Log very slow requests (over 2 seconds for PDF generation)
    if (duration > 2000 && req.path.includes('pdf')) {
      console.warn(`⚠️  Very slow PDF generation: ${req.method} ${route} - ${duration}ms`);
    }
  });
  
  next();
};

// Initialize services: database, cloudinary, auth, and other services
const database = new SupabaseDatabase();
const cloudinaryService = new CloudinaryService();
const generator = new WhatsAppInvoiceGenerator();
const emailService = new SimpleEmailService();
// PDF Generator removed - using Print functionality instead  
const authService = new AuthService(database, emailService);
const xenditService = new XenditService();

// Function to get current business settings
async function getCurrentBusinessSettings(merchantId = null) {
  try {
    console.log('🔍 getCurrentBusinessSettings called for merchantId:', merchantId);
    const dbSettings = await database.getBusinessSettings(merchantId) || {};
    console.log('🔍 Raw dbSettings from database:', dbSettings);
    
    // FIXED: Prioritize merchant-specific database settings over environment variables
    // Environment variables should only be used as fallbacks when no merchant data exists
    return {
      name: dbSettings.name || process.env.MERCHANT_NAME || config.merchant.businessName,
      email: dbSettings.email || process.env.MERCHANT_EMAIL || config.merchant.email,
      address: dbSettings.address || process.env.MERCHANT_ADDRESS || config.merchant.address,
      phone: dbSettings.phone || process.env.MERCHANT_PHONE || config.merchant.phone,
      website: dbSettings.website || process.env.MERCHANT_WEBSITE || config.merchant.website,
      taxId: dbSettings.taxId || process.env.MERCHANT_TAX_ID || config.merchant.taxId,
      taxEnabled: dbSettings.taxEnabled !== undefined ? dbSettings.taxEnabled : (process.env.MERCHANT_TAX_ENABLED === 'true' || config.merchant.taxEnabled || false),
      taxRate: dbSettings.taxRate !== undefined ? dbSettings.taxRate : (parseFloat(process.env.MERCHANT_TAX_RATE) || config.merchant.taxRate || 0),
      taxName: dbSettings.taxName || process.env.MERCHANT_TAX_NAME || config.merchant.taxName || 'PPN',
      taxDescription: dbSettings.taxDescription || process.env.MERCHANT_TAX_DESCRIPTION || config.merchant.taxDescription || '',
      logoUrl: dbSettings.logoUrl || null,
      logoFilename: dbSettings.logoFilename || null,
      hideBusinessName: dbSettings.hideBusinessName || false,
      termsAndConditions: dbSettings.termsAndConditions || ''
    };
  } catch (error) {
    console.error('Error getting business settings:', error);
    // Fallback to config values if database fails
    return {
      name: process.env.MERCHANT_NAME || config.merchant.businessName,
      email: process.env.MERCHANT_EMAIL || config.merchant.email,
      address: process.env.MERCHANT_ADDRESS || config.merchant.address,
      phone: process.env.MERCHANT_PHONE || config.merchant.phone,
      website: process.env.MERCHANT_WEBSITE || config.merchant.website,
      taxId: process.env.MERCHANT_TAX_ID || config.merchant.taxId,
      taxEnabled: process.env.MERCHANT_TAX_ENABLED === 'true' || config.merchant.taxEnabled || false,
      taxRate: parseFloat(process.env.MERCHANT_TAX_RATE) || config.merchant.taxRate || 0,
      taxName: process.env.MERCHANT_TAX_NAME || config.merchant.taxName || 'PPN',
      taxDescription: process.env.MERCHANT_TAX_DESCRIPTION || config.merchant.taxDescription || '',
      logoUrl: null,
      logoFilename: null,
      hideBusinessName: false,
      termsAndConditions: ''
    };
  }
}
const sslManager = new SSLManager();
const aiAutoLearning = new AIAutoLearning(database);

// Merchant configuration (Indonesian market)
const merchantConfig = {
  businessName: config.merchant.businessName,
  address: config.merchant.address,
  phone: config.merchant.phone,
  email: config.merchant.email,
  website: config.merchant.website,
  taxId: config.merchant.taxId,
  paymentTerms: "NET_30",
  catalog: [
    {
      id: "prod_001",
      name: "iPhone 15 Pro",
      description: "Latest iPhone with Pro features",
      sku: "IPHONE15PRO",
      category: "Smartphones",
      price: 16500000,
      tags: ["apple", "iphone", "smartphone", "mobile"]
    },
    {
      id: "prod_002",
      name: "Samsung Galaxy S24",
      description: "Premium Android smartphone",
      sku: "GALAXYS24",
      category: "Smartphones", 
      price: 14800000,
      tags: ["samsung", "galaxy", "android", "smartphone"]
    },
    {
      id: "prod_003",
      name: "AirPods Pro",
      description: "Wireless earbuds with noise cancellation",
      sku: "AIRPODSPRO",
      category: "Audio",
      price: 4100000,
      tags: ["apple", "airpods", "wireless", "earbuds"]
    },
    {
      id: "prod_004",
      name: "MacBook Pro 14",
      description: "Professional laptop with M3 chip",
      sku: "MBP14M3",
      category: "Laptops",
      price: 33000000,
      tags: ["apple", "macbook", "laptop", "m3"]
    },
    {
      id: "prod_005",
      name: "Phone Case",
      description: "Protective phone case",
      sku: "PHONECASE",
      category: "Accessories",
      price: 500000,
      tags: ["case", "protection", "accessory"]
    },
    {
      id: "prod_006",
      name: "Wireless Charger",
      description: "Fast wireless charging pad",
      sku: "WIRELESSCHARGER",
      category: "Accessories",
      price: 825000,
      tags: ["wireless", "charger", "accessory"]
    }
  ]
};

// Performance optimization middleware
app.use(compression()); // Gzip compression for responses

// Security headers - Temporarily disabled for development debugging
// TODO: Re-enable with proper CSP configuration for production
if (!config.isDevelopment) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));
}

app.use(performanceMonitor); // Performance monitoring

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth-specific rate limiting (more lenient for login flows)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 auth requests per windowMs (more generous for dev/testing)
  message: 'Too many authentication requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for AI/PDF endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 AI/PDF requests per windowMs
  message: 'Too many AI/PDF requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to specific API groups (excluding auth endpoints)
app.use('/api/business', apiLimiter);
app.use('/api/products', apiLimiter);
app.use('/api/customers', apiLimiter);
app.use('/api/orders', apiLimiter);
app.use('/api/invoices', apiLimiter);
app.use('/api/premium', apiLimiter);
app.use('/api/upload', apiLimiter);
app.use('/api/remove', apiLimiter);

// Apply auth-specific rate limiting only to auth endpoints
app.use('/api/auth', authLimiter);
app.use('/api/generate-invoice', aiLimiter);
app.use('/api/generate-pdf', aiLimiter);
app.use('/api/export/', aiLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS Configuration
if (config.security.enableCors) {
  app.use(cors({
    origin: config.security.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
}

// Security headers
app.use((req, res, next) => {
  // Explicitly allow all inline scripts and event handlers in development
  if (config.isDevelopment) {
    res.header('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; script-src-attr * 'unsafe-inline' 'unsafe-hashes'; style-src * 'unsafe-inline'; img-src * data: blob:; connect-src *; font-src *; object-src *; media-src *; frame-src *;");
    // Allow framing in development mode
    res.header('X-Frame-Options', 'SAMEORIGIN');
  } else {
    // Strict security in production with blob support for image previews
    res.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data: https:; object-src 'none'; media-src 'self' blob: https:; frame-src 'self';");
    res.header('X-Frame-Options', 'DENY');
  }
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-XSS-Protection', '1; mode=block');
  if (config.isProduction) {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  if (config.development.debugMode) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  next();
});

// Serve only specific static files - prevent direct access to source files
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve only specific files that should be publicly accessible
app.use('/favicon.ico', express.static(path.join(__dirname, '..', 'favicon.ico')));

// Serve mobile notifications script
app.get('/mobile-notifications.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.sendFile(path.join(__dirname, 'mobile-notifications.js'));
});

// Block direct access to source files and other sensitive directories
app.use('/src', (req, res) => {
  res.status(403).json({ error: 'Direct access to source files is not allowed' });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'payment-confirmations');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `payment-${req.params.id || 'unknown'}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow only images and PDFs
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, GIF and PDF files are allowed.'));
    }
  }
});

// Configure multer for custom header/footer logo uploads
const customLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine upload directory based on fieldname
    let subDir = 'custom-headers'; // default for header logos
    if (file.fieldname === 'footerLogo' || file.fieldname.includes('footer')) {
      subDir = 'custom-footers';
    }
    
    const uploadDir = path.join(__dirname, '..', 'uploads', subDir);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    try {
      // Get merchant ID from authenticated request
      const merchantId = req.merchant ? req.merchant.id : 'unknown';
      
      // Generate merchant-specific filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const logoType = (file.fieldname === 'footerLogo' || file.fieldname.includes('footer')) ? 'footer' : 'header';
      
      const filename = `merchant_${merchantId}_${logoType}_logo_${uniqueSuffix}${ext}`;
      cb(null, filename);
    } catch (error) {
      console.error('Error generating filename:', error);
      // Fallback filename generation
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `logo-${uniqueSuffix}${ext}`);
    }
  }
});

const customLogoUpload = multer({
  storage: customLogoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for logos
  },
  fileFilter: function (req, file, cb) {
    // Allow only image files for logos
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed for logos'));
    }
  }
});

// Configure multer for business logo uploads using Cloudinary
const logoUpload = cloudinaryService.getMulterConfig();

// Serve the HTML interface - redirect to login if not authenticated
app.get('/', authMiddleware.optionalAuth, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  // If authenticated, redirect to invoice generator
  if (req.merchant) {
    return res.redirect('/generator');
  }
  
  // Otherwise, redirect to login
  res.redirect('/auth/login');
});

// Test endpoint to serve fresh content with timestamp
app.get('/fresh', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  try {
    let content = fs.readFileSync(path.join(__dirname, 'web-interface-indonesian.html'), 'utf8');
    content = content.replace('<title>', `<title>Fresh ${Date.now()} - `);
    res.send(content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Minimal test endpoint
app.get('/test', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, '..', 'temp', 'test-minimal.html'));
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Serve authentication pages
app.get('/auth/login', authMiddleware.redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'merchant-login.html'));
});

app.get('/auth/register', authMiddleware.redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'merchant-register.html'));
});

app.get('/auth/forgot-password', authMiddleware.redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'merchant-forgot-password.html'));
});

app.get('/auth/reset-password', authMiddleware.redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'merchant-reset-password.html'));
});

// Email verification page
app.get('/auth/verify-email', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send('Missing verification token');
  }
  
  // For now, redirect to a simple success page or handle verification
  res.redirect(`/auth/login?message=verify-email&token=${token}`);
});

// Authentication API Routes
app.use('/api/auth', authMiddleware.authRateLimit());

// Register new merchant
app.post('/api/auth/register', 
  authMiddleware.logAuthEvent('REGISTER'), 
  async (req, res) => {
    try {
      const { fullName, businessName, email, password, agreeTerms } = req.body;

      // Validate required fields
      if (!businessName || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Business name, email, and password are required'
        });
      }

      if (!agreeTerms) {
        return res.status(400).json({
          success: false,
          error: 'You must agree to the terms and conditions'
        });
      }

      // Register merchant
      const result = await authService.registerMerchant({
        fullName,
        businessName,
        email,
        password
      });

      res.json(result);

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed. Please try again.'
      });
    }
  }
);

// Login merchant
app.post('/api/auth/login',
  authMiddleware.logAuthEvent('LOGIN'),
  async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Login merchant
      const result = await authService.loginMerchant(email, password, rememberMe);
      
      // Set secure cookie if successful
      if (result.success && result.token) {
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000 // 30 days or 7 days
        };
        
        res.cookie('merchantToken', result.token, cookieOptions);
      }

      res.json(result);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed. Please try again.'
      });
    }
  }
);

// Verify token
app.get('/api/auth/verify',
  authMiddleware.authenticateMerchant,
  async (req, res) => {
    try {
      // Get full merchant profile
      const profileResult = await authService.getMerchantProfile(req.merchant.id);
      
      if (profileResult.success) {
        res.json({
          success: true,
          merchant: profileResult.profile,
          token: req.token
        });
      } else {
        res.status(404).json(profileResult);
      }

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Token verification failed'
      });
    }
  }
);

// Logout
app.post('/api/auth/logout',
  authMiddleware.logAuthEvent('LOGOUT'),
  async (req, res) => {
    try {
      // Clear all possible token cookies
      res.clearCookie('merchantToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });
      res.clearCookie('authToken');
      res.clearCookie('token');
      
      // Get merchant info from token if available
      let merchantInfo = null;
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1] || req.cookies?.merchantToken;
      
      if (token) {
        const tokenResult = authService.verifyToken(token);
        if (tokenResult.success) {
          merchantInfo = tokenResult.payload;
          console.log(`👋 Merchant logout: ${merchantInfo.email}`);
        }
      }
      
      // Clear any server-side session data if implemented
      // (For future use with Redis or database sessions)
      
      // Set security headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const result = authService.logout();
      
      // Enhanced response with cleanup confirmation and redirect URL
      res.json({
        ...result,
        message: 'Successfully logged out. All sessions cleared.',
        redirectUrl: '/auth/login?from=merchant',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: 'An error occurred during logout. Please clear your browser data.'
      });
    }
  }
);

// Verify email
app.post('/api/auth/verify-email',
  authMiddleware.logAuthEvent('EMAIL_VERIFICATION'),
  async (req, res) => {
    try {
      const { verificationToken } = req.body;
      if (!verificationToken) {
        return res.status(400).json({
          success: false,
          error: 'Verification token is required'
        });
      }

      const result = await authService.verifyEmail(verificationToken);
      res.json(result);
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Email verification failed'
      });
    }
  }
);

// Resend email verification
app.post('/api/auth/resend-verification',
  authMiddleware.logAuthEvent('RESEND_EMAIL_VERIFICATION'),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email address is required'
        });
      }

      const result = await authService.resendEmailVerification(email);
      res.json(result);
    } catch (error) {
      console.error('Resend email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend email verification'
      });
    }
  }
);

// Change password
app.post('/api/auth/change-password',
  authMiddleware.authenticateMerchant,
  authMiddleware.logAuthEvent('PASSWORD_CHANGE'),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
      }

      const result = await authService.changePassword(
        req.merchant.id,
        currentPassword,
        newPassword
      );

      res.json(result);

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Password change failed. Please try again.'
      });
    }
  }
);

// Request password reset
app.post('/api/auth/forgot-password',
  authMiddleware.logAuthEvent('PASSWORD_RESET_REQUEST'),
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email address is required'
        });
      }

      const result = await authService.requestPasswordReset(email);
      res.json(result);

    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        error: 'Password reset request failed. Please try again.'
      });
    }
  }
);

// Reset password with token
app.post('/api/auth/reset-password',
  authMiddleware.logAuthEvent('PASSWORD_RESET'),
  async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Reset token and new password are required'
        });
      }

      const result = await authService.resetPassword(resetToken, newPassword);
      res.json(result);

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Password reset failed. Please try again.'
      });
    }
  }
);

// Get merchant profile
app.get('/api/auth/profile',
  authMiddleware.authenticateMerchant,
  async (req, res) => {
    try {
      const result = await authService.getMerchantProfile(req.merchant.id);
      res.json(result);

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  }
);

// Update merchant profile
app.put('/api/auth/profile',
  authMiddleware.authenticateMerchant,
  authMiddleware.logAuthEvent('PROFILE_UPDATE'),
  async (req, res) => {
    try {
      const result = await authService.updateMerchantProfile(req.merchant.id, req.body);
      res.json(result);

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }
);

// ==========================================
// MERCHANT DASHBOARD ROUTES (Protected)
// ==========================================

// Redirect old invoice dashboard to merchant dashboard
app.get('/dashboard', (req, res) => {
  res.redirect('/merchant#invoices');
});

// Serve the merchant dashboard (Protected)
app.get('/merchant', authMiddleware.authenticateMerchant, (req, res) => {
  console.log('🎯 Merchant dashboard route accessed by:', req.merchant?.email);
  const filePath = path.join(__dirname, 'merchant-dashboard.html');
  console.log('📁 Serving file from:', filePath);

  // Verify the file exists and is readable before serving
  if (!fs.existsSync(filePath)) {
    console.error('❌ Merchant dashboard file not found:', filePath);
    return res.status(404).send('Dashboard not found');
  }

  // Verify it's actually an HTML file by checking the first few bytes
  try {
    const fileBuffer = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    const firstLine = fileBuffer.split('\n')[0].trim();

    if (!firstLine.includes('<!DOCTYPE html>') && !firstLine.includes('<html')) {
      console.error('❌ Invalid file content - not HTML:', firstLine.substring(0, 100));
      return res.status(500).send('Invalid dashboard file');
    }
  } catch (readError) {
    console.error('❌ Error reading dashboard file:', readError);
    return res.status(500).send('Error reading dashboard file');
  }

  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Content-Type', 'text/html; charset=utf-8');

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Error serving merchant dashboard:', err);
      res.status(500).send('Error loading dashboard');
    } else {
      console.log('✅ Merchant dashboard served successfully');
    }
  });
});

// Direct access to merchant-dashboard.html (for navigation buttons) (Protected)
app.get('/merchant-dashboard.html', authMiddleware.authenticateMerchant, (req, res) => {
  console.log('🎯 Merchant dashboard HTML route accessed by:', req.merchant?.email);
  const filePath = path.join(__dirname, 'merchant-dashboard.html');
  console.log('📁 Serving HTML file from:', filePath);

  // Verify the file exists and is readable before serving
  if (!fs.existsSync(filePath)) {
    console.error('❌ Merchant dashboard file not found:', filePath);
    return res.status(404).send('Dashboard not found');
  }

  // Verify it's actually an HTML file by checking the first few bytes
  try {
    const fileBuffer = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    const firstLine = fileBuffer.split('\n')[0].trim();

    if (!firstLine.includes('<!DOCTYPE html>') && !firstLine.includes('<html')) {
      console.error('❌ Invalid file content - not HTML:', firstLine.substring(0, 100));
      return res.status(500).send('Invalid dashboard file');
    }
  } catch (readError) {
    console.error('❌ Error reading dashboard file:', readError);
    return res.status(500).send('Error reading dashboard file');
  }

  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Content-Type', 'text/html; charset=utf-8');

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Error serving merchant dashboard HTML:', err);
      res.status(500).send('Error loading dashboard');
    } else {
      console.log('✅ Merchant dashboard HTML served successfully');
    }
  });
});

// Serve the business settings page (Protected)
app.get('/business-settings', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'business-settings.html'));
});

// Serve the main invoice generator interface (Protected)
app.get('/generator', authMiddleware.authenticateMerchant, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'web-interface-indonesian.html'));
});

// Serve the customer portal (legacy - for backwards compatibility)
app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'customer-portal.html'));
});

// Serve specific invoice for customer (with token) - NEW SIMPLIFIED VIEW
app.get('/customer/invoice/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'simple-invoice-view.html'));
});

// Simple invoice view (direct link from emails)
app.get('/invoice', (req, res) => {
  res.sendFile(path.join(__dirname, 'simple-invoice-view.html'));
});

// Public invoice viewing route
app.get('/invoice/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'simple-invoice-view.html'));
});

// Direct access to simple-invoice-view.html (for generated URLs)
app.get('/simple-invoice-view.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'simple-invoice-view.html'));
});

// Service ticket printing page
app.get('/service-ticket', (req, res) => {
  res.sendFile(path.join(__dirname, 'service-ticket.html'));
});

// Final payment page
app.get('/final-payment', (req, res) => {
  res.sendFile(path.join(__dirname, 'final-payment.html'));
});

// API endpoint to get business profile
app.get('/api/business-profile', authMiddleware.authenticateMerchant, (req, res) => {
  res.json({
    success: true,
    profile: {
      businessName: config.merchant.businessName,
      address: config.merchant.address,
      phone: config.merchant.phone,
      email: config.merchant.email,
      website: config.merchant.website,
      taxId: config.merchant.taxId,
      defaultTaxRate: config.merchant.taxRate || 0,
      additionalNotes: ""
    }
  });
});

// API endpoint to save business profile
app.post('/api/business-profile', authMiddleware.authenticateMerchant, (req, res) => {
  try {
    const { profile } = req.body;
    // In a real app, this would save to database
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Business profile saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to save business profile'
    });
  }
});

// Business settings API endpoints
app.get('/api/business-settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('🔍 Loading business settings for merchant:', req.merchant.id, req.merchant.email);
    const settings = await database.getBusinessSettings(req.merchant.id);
    console.log('🔍 Raw settings from database:', settings);
    console.log('🔍 Settings object keys:', Object.keys(settings || {}));
    
    // If no settings in database, return config defaults
    if (!settings || Object.keys(settings).length === 0) {
      console.log('🔍 No settings found, returning defaults');
      const defaults = {
        name: config.merchant.businessName,
        email: config.merchant.email,
        address: config.merchant.address,
        phone: config.merchant.phone,
        website: config.merchant.website,
        taxId: config.merchant.taxId,
        taxRate: config.merchant.taxRate || 0,
        taxEnabled: config.merchant.taxRate > 0,
        taxName: 'PPN',
        taxDescription: '',
        termsAndConditions: '',
        // Include empty logo fields so frontend doesn't get undefined
        logoUrl: null,
        logoPublicId: null,
        logoFilename: null
      };
      console.log('🔍 Returning default settings:', defaults);
      return res.json(defaults);
    }
    
    console.log('🔍 Returning actual settings:', settings);
    res.json(settings);
  } catch (error) {
    console.error('Error loading business settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load business settings'
    });
  }
});

app.post('/api/business-settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const settings = req.body;
    console.log('🏢 Updating business settings for merchant:', req.merchant.id, req.merchant.email);
    console.log('🏢 Settings payload:', JSON.stringify(settings, null, 2));
    
    const updatedSettings = await database.updateBusinessSettings(settings, req.merchant.id);
    console.log('🏢 Database update result:', updatedSettings ? 'Success' : 'Failed');
    console.log('🏢 Updated settings returned:', updatedSettings);
    
    res.json({
      success: true,
      message: 'Business settings saved successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error saving business settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save business settings'
    });
  }
});

// Route aliases to handle frontend calls to /api/business/settings (with slash)
app.get('/api/business/settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('🏢 Loading business settings for merchant:', req.merchant.id);
    const settings = await database.getBusinessSettings(req.merchant.id);
    console.log('🏢 Loaded settings - Premium active:', settings?.premiumActive);
    
    // If no settings in database, return config defaults
    if (!settings || Object.keys(settings).length === 0) {
      console.log('🏢 No settings found, returning defaults');
      return res.json({
        success: true,
        settings: {
          name: config.merchant.businessName,
          email: config.merchant.email,
          address: config.merchant.address,
          phone: config.merchant.phone,
          website: config.merchant.website,
          taxId: config.merchant.taxId,
          taxRate: config.merchant.taxRate || 0,
          taxEnabled: config.merchant.taxRate > 0,
          taxName: 'PPN',
          taxDescription: '',
          termsAndConditions: '',
          logoUrl: null,
          logoPublicId: null,
          logoFilename: null,
          premiumActive: false
        }
      });
    }
    
    // Return settings wrapped in success object for consistent API response
    res.json({
      success: true,
      settings: settings
    });
  } catch (error) {
    console.error('❌ Error loading business settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load business settings'
    });
  }
});

app.post('/api/business/settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const settings = req.body;
    console.log('🏢 Updating business settings via /api/business/settings for merchant:', req.merchant.id, settings);
    
    const updatedSettings = await database.updateBusinessSettings(settings, req.merchant.id);
    
    res.json({
      success: true,
      message: 'Business settings saved successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error saving business settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save business settings'
    });
  }
});

app.put('/api/business/settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const settings = req.body;
    console.log('🏢 Updating business settings via PUT /api/business/settings for merchant', req.merchant.id, ':', settings);
    
    const updatedSettings = await database.updateBusinessSettings(settings, req.merchant.id);
    
    res.json({
      success: true,
      message: 'Business settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating business settings via PUT:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update business settings'
    });
  }
});

// Premium Branding API Endpoints
app.get('/api/premium/status', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const isPremium = await database.isPremiumActive(req.merchant.id);
    const brandingSettings = isPremium ? await database.getPremiumBrandingSettings(req.merchant.id) : null;
    
    res.json({
      success: true,
      isPremium: isPremium,
      brandingSettings: brandingSettings
    });
  } catch (error) {
    console.error('Error checking premium status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check premium status'
    });
  }
});

app.post('/api/premium/activate', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { premiumSettings = {} } = req.body;
    
    console.log('🏆 Activating premium branding for merchant:', req.merchant.id);
    console.log('🏆 Premium settings to apply:', premiumSettings);
    
    // Check if business settings exist first
    let existingSettings;
    try {
      existingSettings = await database.getBusinessSettings(req.merchant.id);
      console.log('🏢 Existing business settings:', existingSettings ? 'Found' : 'Not found');
    } catch (error) {
      console.log('⚠️ Error getting existing settings:', error.message);
      // Create default business settings if they don't exist
      existingSettings = {};
    }
    
    // Activate premium branding
    console.log('🏆 Calling activatePremiumBranding...');
    const result = await database.activatePremiumBranding(premiumSettings, req.merchant.id);
    console.log('🏆 Premium activation result:', result);
    
    // Verify the activation worked by checking the database
    const verifySettings = await database.getBusinessSettings(req.merchant.id);
    console.log('🔍 Verification - Premium active after update:', verifySettings?.premiumActive);
    
    res.json({
      success: true,
      message: 'Premium branding activated successfully',
      settings: result
    });
  } catch (error) {
    console.error('❌ Error activating premium branding:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to activate premium branding: ' + error.message
    });
  }
});

app.post('/api/premium/deactivate', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const result = await database.deactivatePremiumBranding(req.merchant.id);
    
    res.json({
      success: true,
      message: 'Premium branding deactivated successfully',
      settings: result
    });
  } catch (error) {
    console.error('Error deactivating premium branding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate premium branding'
    });
  }
});

app.put('/api/premium/branding', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const isPremium = await database.isPremiumActive(req.merchant.id);
    if (!isPremium) {
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required for custom branding'
      });
    }
    
    const brandingSettings = req.body;
    console.log('🎨 Updating premium branding settings:', brandingSettings);
    
    // Update the business settings with the new branding
    const result = await database.updateBusinessSettings({
      ...brandingSettings,
      premiumActive: true // Ensure premium remains active
    }, req.merchant.id);
    
    res.json({
      success: true,
      message: 'Premium branding settings updated successfully',
      settings: result
    });
  } catch (error) {
    console.error('Error updating premium branding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update premium branding settings'
    });
  }
});

// Premium Logo Upload Endpoints
app.post('/api/premium/upload/header-logo', authMiddleware.authenticateMerchant, logoUpload.single('headerLogo'), async (req, res) => {
  try {
    console.log('📤 Header logo upload request from merchant:', req.merchant?.id);
    console.log('📄 File info:', req.file);
    
    const isPremium = await database.isPremiumActive(req.merchant.id);
    if (!isPremium) {
      console.log('❌ Premium not active for merchant:', req.merchant.id);
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required for custom logos'
      });
    }
    
    if (!req.file) {
      console.log('❌ No file provided in request');
      return res.status(400).json({
        success: false,
        error: 'No header logo file provided'
      });
    }
    
    // Get current settings to check for existing logo
    const currentSettings = await database.getBusinessSettings(req.merchant.id);
    
    // Upload to Cloudinary instead of local storage
    const uploadResult = await cloudinaryService.uploadImage(req.file.buffer, {
      filename: `merchant_${req.merchant.id}_header_logo_${Date.now()}`,
      merchantId: req.merchant.id,
      folder: 'ai-invoice-generator/premium-headers'
    });
    
    // Delete old header logo from Cloudinary if it exists
    if (currentSettings.customHeaderLogoPublicId) {
      console.log('🗑️  Deleting old header logo from Cloudinary:', currentSettings.customHeaderLogoPublicId);
      const deleteResult = await cloudinaryService.deleteImage(currentSettings.customHeaderLogoPublicId);
      if (deleteResult.success) {
        console.log('✅ Old header logo deleted successfully');
      } else {
        console.warn('⚠️  Failed to delete old header logo:', deleteResult.error);
      }
    }
    
    if (!uploadResult.success) {
      console.error('❌ Cloudinary upload failed:', uploadResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload header logo to cloud storage'
      });
    }
    
    console.log('📍 Logo URL generated:', uploadResult.url);
    
    // Update business settings with Cloudinary URL
    const result = await database.updateBusinessSettings({
      customHeaderLogoUrl: uploadResult.url,
      customHeaderLogoPublicId: uploadResult.publicId // Store for deletion later
    }, req.merchant.id);
    
    console.log('✅ Header logo upload successful:', uploadResult.url);
    res.json({
      success: true,
      message: 'Header logo uploaded successfully to cloud storage',
      logoUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      settings: result
    });
  } catch (error) {
    console.error('❌ Error uploading header logo:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to upload header logo: ' + error.message
    });
  }
});

app.post('/api/premium/upload/footer-logo', authMiddleware.authenticateMerchant, logoUpload.single('footerLogo'), async (req, res) => {
  try {
    console.log('📤 Footer logo upload request from merchant:', req.merchant?.id);
    console.log('📄 File info:', req.file);
    
    const isPremium = await database.isPremiumActive(req.merchant.id);
    if (!isPremium) {
      console.log('❌ Premium not active for merchant:', req.merchant.id);
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required for custom logos'
      });
    }
    
    if (!req.file) {
      console.log('❌ No file provided in request');
      return res.status(400).json({
        success: false,
        error: 'No footer logo file provided'
      });
    }
    
    // Get current settings to check for existing logo
    const currentSettings = await database.getBusinessSettings(req.merchant.id);
    
    // Upload to Cloudinary instead of local storage
    const uploadResult = await cloudinaryService.uploadImage(req.file.buffer, {
      filename: `merchant_${req.merchant.id}_footer_logo_${Date.now()}`,
      merchantId: req.merchant.id,
      folder: 'ai-invoice-generator/premium-footers'
    });
    
    // Delete old footer logo from Cloudinary if it exists
    if (currentSettings.customFooterLogoPublicId) {
      console.log('🗑️  Deleting old footer logo from Cloudinary:', currentSettings.customFooterLogoPublicId);
      const deleteResult = await cloudinaryService.deleteImage(currentSettings.customFooterLogoPublicId);
      if (deleteResult.success) {
        console.log('✅ Old footer logo deleted successfully');
      } else {
        console.warn('⚠️  Failed to delete old footer logo:', deleteResult.error);
      }
    }
    
    if (!uploadResult.success) {
      console.error('❌ Cloudinary upload failed:', uploadResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload footer logo to cloud storage'
      });
    }
    
    console.log('📍 Logo URL generated:', uploadResult.url);
    
    // Update business settings with Cloudinary URL
    const result = await database.updateBusinessSettings({
      customFooterLogoUrl: uploadResult.url,
      customFooterLogoPublicId: uploadResult.publicId // Store for deletion later
    }, req.merchant.id);
    
    console.log('✅ Footer logo upload successful:', uploadResult.url);
    res.json({
      success: true,
      message: 'Footer logo uploaded successfully to cloud storage',
      logoUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      settings: result
    });
  } catch (error) {
    console.error('❌ Error uploading footer logo:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to upload footer logo: ' + error.message
    });
  }
});

// Payment methods API endpoint
app.get('/api/settings/payment-methods', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const paymentMethods = await database.getPaymentMethods(req.merchant.id);
    
    res.json({
      success: true,
      paymentMethods: paymentMethods
    });
  } catch (error) {
    console.error('Error loading payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load payment methods'
    });
  }
});

// Alternative payment methods API endpoint (without /settings/)
app.get('/api/payment-methods', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const paymentMethods = await database.getPaymentMethods(req.merchant.id);
    
    res.json({
      success: true,
      paymentMethods: paymentMethods
    });
  } catch (error) {
    console.error('Error loading payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load payment methods'
    });
  }
});

// Business logo upload endpoint
app.post('/api/upload-business-logo', authMiddleware.authenticateMerchant, logoUpload.single('logo'), async (req, res) => {
  try {
    console.log('📸 Logo upload request received for merchant:', req.merchant?.id);
    
    if (!req.file) {
      console.log('❌ No logo file in request');
      return res.status(400).json({
        success: false,
        error: 'No logo file uploaded'
      });
    }

    console.log('📸 Business logo uploading to Cloudinary...', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
    
    // Upload to Cloudinary with merchant isolation and old logo cleanup
    const currentSettings = await database.getBusinessSettings(req.merchant.id) || {};
    const businessName = currentSettings.name || 'business';
    const oldPublicId = currentSettings.logo_public_id || currentSettings.logoPublicId;
    
    console.log('🏢 Uploading logo for merchant:', {
      merchantId: req.merchant.id,
      businessName: businessName,
      oldPublicId: oldPublicId
    });
    
    const uploadResult = await cloudinaryService.uploadBusinessLogo(
      req.file.buffer, 
      businessName,
      req.merchant.id,  // Add merchant ID for isolation
      oldPublicId       // Add old public ID for cleanup
    );
    
    if (!uploadResult.success) {
      console.error('❌ Cloudinary upload failed:', uploadResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload logo to cloud storage: ' + uploadResult.error
      });
    }

    console.log('✅ Logo uploaded to Cloudinary:', {
      publicId: uploadResult.publicId,
      url: uploadResult.url,
      width: uploadResult.width,
      height: uploadResult.height
    });
    
    // Delete old logo from Cloudinary if it exists
    if (currentSettings.logo_public_id) {
      console.log('🗑️  Deleting old logo from Cloudinary:', currentSettings.logo_public_id);
      const deleteResult = await cloudinaryService.deleteImage(currentSettings.logo_public_id);
      if (deleteResult.success) {
        console.log('✅ Old logo deleted successfully');
      } else {
        console.error('⚠️  Failed to delete old logo:', deleteResult.error);
      }
    }
    
    // Update business settings with the new Cloudinary URL
    const updatedSettings = {
      ...currentSettings,
      logo_url: uploadResult.url,
      logo_public_id: uploadResult.publicId,
      logo_filename: uploadResult.publicId
    };
    
    console.log('📋 Updating business settings with logo:', {
      merchantId: req.merchant.id,
      merchantEmail: req.merchant.email,
      logo_url: updatedSettings.logo_url,
      logo_public_id: updatedSettings.logo_public_id,
      updating_fields: Object.keys(updatedSettings).filter(key => key.includes('logo'))
    });
    
    const updateResult = await database.updateBusinessSettings(updatedSettings, req.merchant.id);
    console.log('✅ Database update result:', { 
      success: !!updateResult,
      merchantId: req.merchant.id,
      resultData: updateResult 
    });
    
    res.json({
      success: true,
      message: 'Logo uploaded successfully to cloud storage',
      logoUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      cloudinary: {
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes
      },
      debug: {
        oldLogoDeleted: !!currentSettings.logo_public_id,
        updatedDatabase: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error uploading business logo:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Failed to upload logo: ' + error.message
    });
  }
});

// Remove business logo endpoint
app.delete('/api/remove-business-logo', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('🗑️  Logo removal request received for merchant:', req.merchant?.id);
    
    const currentSettings = await database.getBusinessSettings(req.merchant.id) || {};
    console.log('📋 Current business settings:', {
      hasLogoUrl: !!currentSettings.logo_url,
      hasLogoPublicId: !!currentSettings.logo_public_id,
      hasLogoFilename: !!currentSettings.logo_filename,
      logoUrl: currentSettings.logo_url,
      logoPublicId: currentSettings.logo_public_id
    });
    
    // Delete from Cloudinary if it exists
    if (currentSettings.logo_public_id) {
      console.log('🗑️  Deleting logo from Cloudinary:', currentSettings.logo_public_id);
      const deleteResult = await cloudinaryService.deleteImage(currentSettings.logo_public_id);
      
      if (deleteResult.success) {
        console.log('✅ Logo deleted from Cloudinary successfully');
      } else {
        console.error('⚠️  Failed to delete logo from Cloudinary:', deleteResult.error);
        // Continue with database update even if Cloudinary deletion fails
      }
    } else {
      console.log('ℹ️  No logo_public_id found, skipping Cloudinary deletion');
    }
    
    // Remove logo info from database
    const updatedSettings = {
      ...currentSettings,
      logo_url: null,
      logo_public_id: null,
      logo_filename: null
    };
    
    console.log('📋 Removing logo from business settings:', {
      before_logo_url: currentSettings.logo_url,
      before_logo_public_id: currentSettings.logo_public_id,
      after_logo_url: updatedSettings.logo_url,
      updating_fields: Object.keys(updatedSettings).filter(key => key.includes('logo'))
    });
    
    const updateResult = await database.updateBusinessSettings(updatedSettings, req.merchant.id);
    console.log('✅ Database update result:', { success: !!updateResult });
    
    res.json({
      success: true,
      message: 'Logo removed successfully from cloud storage',
      debug: {
        hadLogo: !!currentSettings.logo_url,
        removedFromCloudinary: !!currentSettings.logo_public_id,
        updatedDatabase: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error removing business logo:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to remove logo: ' + error.message
    });
  }
});

// Account Settings API endpoints
app.get('/api/account-settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const settings = await database.getAccountSettings(req.merchant.id);
    res.json(settings || {});
  } catch (error) {
    console.error('Error loading account settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load account settings'
    });
  }
});

app.post('/api/account-settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const settings = req.body;
    console.log('👤 Updating account settings for merchant:', req.merchant.id, settings);
    
    const updatedSettings = await database.updateAccountSettings(settings, req.merchant.id);
    
    res.json({
      success: true,
      message: 'Account settings saved successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error saving account settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save account settings'
    });
  }
});

// Usage Statistics API endpoint
app.get('/api/usage-stats', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const stats = await database.getUsageStatistics(req.merchant.id);
    res.json(stats);
  } catch (error) {
    console.error('Error loading usage statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load usage statistics'
    });
  }
});

// Subscription Info API endpoint
app.get('/api/subscription-info', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const subscription = await database.getSubscriptionInfo();
    res.json(subscription || {
      plan: 'free',
      planName: 'Free Plan',
      features: [
        'Unlimited invoices',
        'Up to 100 customers',
        'Basic payment methods',
        'Email support',
        'Standard templates'
      ],
      limits: {
        customers: 100,
        invoices: -1, // unlimited
        emailsPerMonth: 1000
      }
    });
  } catch (error) {
    console.error('Error loading subscription info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load subscription info'
    });
  }
});

// Data Export API endpoint
app.get('/api/export-data', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('📥 Exporting account data for merchant:', req.merchant.id);
    
    const data = await database.exportAllData(req.merchant.id);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=account-data.json');
    res.json(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data'
    });
  }
});

// Backup API endpoint  
app.get('/api/backup-data', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('💾 Creating backup...');
    
    const backupData = await database.createBackup();
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=backup.zip');
    res.send(backupData);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup'
    });
  }
});

// Account Reset API endpoint
app.post('/api/reset-account', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('🔄 Resetting account data...');
    
    await database.resetAccountData();
    
    res.json({
      success: true,
      message: 'Account reset successfully'
    });
  } catch (error) {
    console.error('Error resetting account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset account'
    });
  }
});

// Payment Methods API endpoints
app.get('/api/payment-methods', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const paymentMethods = await database.getPaymentMethods(req.merchant.id);
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error loading payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load payment methods'
    });
  }
});

app.post('/api/payment-methods', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const methods = req.body;
    console.log('💳 Updating payment methods for merchant', req.merchant.id, ':', methods);
    
    const updatedMethods = await database.updatePaymentMethods(methods, req.merchant.id);
    
    res.json({
      success: true,
      message: 'Payment methods saved successfully',
      data: updatedMethods
    });
  } catch (error) {
    console.error('Error saving payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save payment methods'
    });
  }
});

// Xendit API endpoints
app.post('/api/xendit/test', async (req, res) => {
  try {
    const { secretKey, environment, amount } = req.body;
    
    if (!secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key is required'
      });
    }
    
    console.log('🧪 Testing Xendit connection...', environment);
    const result = await xenditService.testConnection(secretKey, environment);
    
    res.json(result);
  } catch (error) {
    console.error('Xendit test error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test Xendit connection'
    });
  }
});

app.post('/api/xendit/create-payment', async (req, res) => {
  try {
    const { invoiceId, paymentData } = req.body;
    
    if (!invoiceId || !paymentData) {
      return res.status(400).json({
        success: false,
        error: 'Invoice ID and payment data are required'
      });
    }
    
    // Get Xendit credentials from database
    const credentials = await database.getXenditCredentials();
    if (!credentials || !credentials.secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Xendit is not configured. Please configure Xendit in business settings.'
      });
    }
    
    // Get invoice details
    const invoice = await database.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Create Xendit invoice
    const xenditInvoiceData = {
      externalId: `${invoice.invoice_number}-${Date.now()}`,
      amount: invoice.grand_total,
      description: `Payment for Invoice ${invoice.invoice_number}`,
      customer: {
        name: invoice.customer_name,
        email: invoice.customer_email,
        phone: invoice.customer_phone
      },
      successUrl: `${req.protocol}://${req.get('host')}/customer?token=${invoice.customer_token}&payment=success`,
      failureUrl: `${req.protocol}://${req.get('host')}/customer?token=${invoice.customer_token}&payment=failed`,
      currency: 'IDR',
      paymentMethods: xenditService.getPaymentMethodsForInvoice(credentials.paymentMethods)
    };
    
    const result = await xenditService.createInvoice(
      credentials.secretKey,
      credentials.environment,
      xenditInvoiceData
    );
    
    if (result.success) {
      // Store Xendit invoice reference in database
      // This could be added to invoice metadata or a separate xendit_payments table
      console.log('✅ Xendit payment created:', result.data.id);
      
      res.json({
        success: true,
        paymentUrl: result.data.invoice_url,
        xenditInvoiceId: result.data.id,
        externalId: result.data.external_id
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating Xendit payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Xendit payment'
    });
  }
});

app.post('/api/xendit/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-callback-token'] || req.headers['x-xendit-callback-token'];
    const rawBody = JSON.stringify(req.body);
    
    // Get webhook token from database
    const credentials = await database.getXenditCredentials();
    
    // Verify webhook signature if token is configured
    if (credentials && credentials.webhookToken) {
      const isValid = xenditService.verifyWebhookSignature(rawBody, signature, credentials.webhookToken);
      if (!isValid) {
        console.warn('❌ Invalid webhook signature from Xendit');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // Parse webhook event
    const event = xenditService.parseWebhookEvent(req.body);
    if (!event) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }
    
    console.log('📨 Xendit webhook received:', event.event, event.externalId, event.status);
    
    // Find the corresponding invoice by external ID
    // The external ID format is: {invoice_number}-{timestamp}
    const invoiceNumber = event.externalId.split('-')[0];
    const invoice = await database.getInvoiceByNumber(invoiceNumber);
    
    if (!invoice) {
      console.warn(`⚠️ Invoice not found for Xendit webhook: ${invoiceNumber}`);
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Update invoice status based on Xendit event
    if (event.status === 'PAID') {
      await database.updateInvoiceStatus(invoice.id, 'paid', invoice.merchant_id);
      console.log(`✅ Invoice ${invoice.invoice_number} marked as paid via Xendit`);
      
      // You could add additional logic here:
      // - Send payment confirmation email
      // - Update inventory
      // - Trigger order fulfillment
    } else if (event.status === 'EXPIRED') {
      console.log(`⏰ Xendit payment expired for invoice ${invoice.invoice_number}`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    console.error('Xendit webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Payment confirmation upload endpoint
app.post('/api/invoices/:id/payment-confirmation', upload.single('paymentProof'), async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const notes = req.body.notes || '';
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Server-side file validation
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Please upload JPG, PNG, or PDF files only.'
      });
    }

    // File size validation (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }

    // Very small file validation
    if (req.file.size < 1024) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'File too small or corrupted. Please upload a valid file.'
      });
    }
    
    // Save payment confirmation to database
    const confirmationData = {
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      notes: notes
    };
    
    const updatedInvoice = await database.addPaymentConfirmation(invoiceId, confirmationData);
    
    if (!updatedInvoice) {
      // Clean up uploaded file if invoice not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    console.log('✅ Payment confirmation uploaded for invoice:', invoiceId);
    
    res.json({
      success: true,
      message: 'Payment confirmation uploaded successfully',
      invoice: updatedInvoice
    });
  } catch (error) {
    console.error('Error uploading payment confirmation:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to upload payment confirmation';
    let statusCode = 500;
    
    if (error.message && error.message.includes('Invoice not found')) {
      errorMessage = 'Invoice not found. Please verify the invoice ID.';
      statusCode = 404;
    } else if (error.code === 'ENOENT') {
      errorMessage = 'File upload failed. Please try again.';
      statusCode = 400;
    } else if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
      errorMessage = 'Database schema issue. Missing payment confirmation columns. Please contact support.';
      statusCode = 500;
    } else if (error.message && error.message.includes('timeout')) {
      errorMessage = 'Database connection timeout. Please try again.';
      statusCode = 503;
    } else if (error.message) {
      errorMessage = `Upload failed: ${error.message}`;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Down Payment Confirmation API
app.post('/api/invoices/:id/confirm-down-payment', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await database.getInvoice(invoiceId, req.merchant.id);
    
    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invoice not found' 
      });
    }

    // Check if invoice is in down payment stage
    if (invoice.payment_stage !== 'down_payment') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invoice is not in down payment stage. Current stage: ' + invoice.payment_stage 
      });
    }

    // Check if invoice has payment schedule
    const paymentSchedule = typeof invoice.payment_schedule_json === 'string' 
      ? JSON.parse(invoice.payment_schedule_json || 'null') 
      : (invoice.payment_schedule_json || null);
    if (!paymentSchedule || paymentSchedule.scheduleType !== 'down_payment') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invoice does not have down payment schedule' 
      });
    }

    // Calculate final payment amount (grand total minus down payment)
    const finalPaymentAmount = invoice.grand_total - paymentSchedule.downPayment.amount;
    
    // Generate final payment token
    const finalPaymentToken = database.generateCustomerToken();
    
    // Extract final payment due date from payment schedule
    const finalPaymentDueDate = paymentSchedule.remainingBalance.dueDate;
    
    // Update invoice to down payment confirmed stage
    const updatedInvoice = {
      ...invoice,
      status: 'dp_paid',
      payment_stage: 'final_payment',
      payment_status: 'partial',
      final_payment_token: finalPaymentToken,
      final_payment_amount: finalPaymentAmount,
      due_date: finalPaymentDueDate,                // Update due date to final payment due date
      original_due_date: invoice.due_date,          // Preserve original due date
      dp_confirmed_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update payment schedule to mark down payment as paid
    paymentSchedule.downPayment.status = 'paid';
    paymentSchedule.downPayment.paidDate = new Date().toISOString();
    
    // Update remaining balance to reflect the correct final payment amount
    paymentSchedule.remainingBalance.amount = finalPaymentAmount;
    paymentSchedule.remainingBalance.status = 'pending';
    
    updatedInvoice.payment_schedule_json = JSON.stringify(paymentSchedule);

    // Save changes to Supabase database
    await database.updateInvoice(invoiceId, updatedInvoice, req.merchant.id);
    
    console.log(`✅ Down payment confirmed for invoice ${invoice.invoice_number}`);
    
    res.json({
      success: true,
      message: 'Down payment confirmed successfully',
      finalPaymentToken: finalPaymentToken,
      finalPaymentAmount: finalPaymentAmount,
      finalPaymentLink: `${req.protocol}://${req.get('host')}/final-payment?token=${finalPaymentToken}`,
      invoice: updatedInvoice
    });
    
  } catch (error) {
    console.error('Error confirming down payment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to confirm down payment: ' + error.message 
    });
  }
});

// Final Payment Confirmation API
app.post('/api/invoices/:id/confirm-final-payment', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await database.getInvoice(invoiceId, req.merchant.id);
    
    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invoice not found' 
      });
    }

    // Check if invoice is in final payment stage (should be 'final_payment' for this endpoint)
    if (invoice.payment_stage !== 'final_payment') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invoice is not in final payment stage. Current stage: ' + invoice.payment_stage 
      });
    }

    // Update invoice to fully paid
    const updatedInvoice = {
      ...invoice,
      status: 'paid',
      payment_stage: 'completed',
      payment_status: 'paid',
      final_payment_confirmed_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update payment schedule to mark remaining balance as paid
    const paymentSchedule = typeof invoice.payment_schedule_json === 'string' 
      ? JSON.parse(invoice.payment_schedule_json || 'null') 
      : (invoice.payment_schedule_json || null);
    if (paymentSchedule) {
      paymentSchedule.remainingBalance.status = 'paid';
      paymentSchedule.remainingBalance.paidDate = new Date().toISOString();
      updatedInvoice.payment_schedule_json = JSON.stringify(paymentSchedule);
    }

    // Save changes to Supabase database
    await database.updateInvoice(invoiceId, updatedInvoice, req.merchant.id);
    
    // Auto-create order from fully paid invoice
    let orderResult = null;
    try {
      orderResult = await database.createOrderFromInvoice(invoiceId, req.merchant.id);
      console.log(`✅ Order ${orderResult.orderNumber} auto-created from fully paid invoice ${invoice.invoice_number}`);
    } catch (orderError) {
      console.error('Failed to auto-create order:', orderError);
      // Don't fail the payment confirmation if order creation fails
    }

    console.log(`✅ Final payment confirmed for invoice ${invoice.invoice_number}`);
    
    res.json({
      success: true,
      message: 'Final payment confirmed successfully, invoice moved to orders',
      orderId: orderResult?.lastInsertRowid,
      orderNumber: orderResult?.orderNumber,
      invoice: updatedInvoice
    });
    
  } catch (error) {
    console.error('Error confirming final payment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to confirm final payment: ' + error.message 
    });
  }
});

// Final payment confirmation upload (token-based)
app.post('/api/final-payment/:token/payment-confirmation', upload.single('paymentProof'), async (req, res) => {
  try {
    const token = req.params.token;
    const notes = req.body.notes || '';
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    // Find invoice by final payment token
    const invoice = await database.getInvoiceByFinalPaymentToken(token);
    if (!invoice) {
      // Clean up uploaded file if invoice not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Final payment link not found or expired'
      });
    }

    // Check if invoice is in correct stage
    if (invoice.payment_stage !== 'final_payment') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Invoice is not in final payment stage'
      });
    }
    
    // Save payment confirmation to database
    const confirmationData = {
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      notes: notes,
      paymentType: 'final_payment'
    };
    
    const updatedInvoice = await database.addPaymentConfirmation(invoice.id, confirmationData);
    
    if (!updatedInvoice) {
      // Clean up uploaded file if update failed
      fs.unlinkSync(req.file.path);
      return res.status(500).json({
        success: false,
        error: 'Failed to save payment confirmation'
      });
    }
    
    console.log(`✅ Final payment confirmation uploaded for invoice: ${invoice.invoice_number}`);
    
    res.json({
      success: true,
      message: 'Final payment confirmation uploaded successfully',
      invoice: updatedInvoice
    });
    
  } catch (error) {
    console.error('Error uploading final payment confirmation:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to upload payment confirmation'
    });
  }
});

// Get final payment token details
app.get('/api/final-payment/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const invoice = await database.getInvoiceByFinalPaymentToken(token);
    
    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        error: 'Final payment link not found or expired' 
      });
    }

    // Check if already paid
    if (invoice.payment_stage === 'completed') {
      return res.status(400).json({ 
        success: false, 
        error: 'Final payment already completed' 
      });
    }

    const paymentSchedule = typeof invoice.payment_schedule_json === 'string' 
      ? JSON.parse(invoice.payment_schedule_json || 'null') 
      : (invoice.payment_schedule_json || null);
    
    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        grand_total: invoice.grand_total,
        currency: invoice.currency,
        final_payment_amount: invoice.final_payment_amount,
        down_payment_amount: paymentSchedule?.downPayment?.amount || 0,
        payment_schedule: paymentSchedule
      }
    });
    
  } catch (error) {
    console.error('Error getting final payment details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get payment details' 
    });
  }
});

// Serve uploaded payment confirmation files (protected)
app.get('/api/payment-confirmations/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '..', 'uploads', 'payment-confirmations', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving payment confirmation file:', error);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

// Email settings API endpoints
app.get('/api/email-settings', (req, res) => {
  const status = emailService.getStatus();
  res.json({
    success: true,
    settings: {
      host: status.host || 'smtp.gmail.com',
      port: emailService.config?.port || 587,
      secure: emailService.config?.secure || false,
      user: status.user || ''
      // Don't return password for security
    },
    status: status
  });
});

app.post('/api/email-settings', async (req, res) => {
  try {
    const settings = req.body;
    
    console.log('📧 Updating email settings:', { user: settings.user, host: settings.host });
    
    // Update email service configuration
    const success = await emailService.updateConfig(settings);
    
    if (success) {
      res.json({
        success: true,
        message: 'Email settings saved and tested successfully',
        status: emailService.getStatus()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Email configuration test failed - please check your credentials',
        status: emailService.getStatus()
      });
    }
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save email settings: ' + error.message
    });
  }
});

// Email status API endpoint
app.get('/api/email-status', (req, res) => {
  const status = emailService.getStatus();
  
  res.json({
    success: true,
    saasConfigured: status.configured,
    customConfigured: status.configured,
    configured: status.configured,
    mockMode: status.mockMode,
    isInitialized: status.configured,
    ...status
  });
});

// Test email API endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'Test email address is required'
      });
    }
    
    console.log('🧪 Testing email to:', testEmail);
    
    // Use the email service to send test email
    const result = await emailService.sendTestEmail(testEmail);
    
    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        message: result.message || 'Test email sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send test email'
      });
    }
    
  } catch (error) {
    console.error('Email test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test email failed: ' + error.message
    });
  }
});

// STAGE 1: Preview-only invoice generation (no database save)
app.post('/api/preview-invoice', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, businessProfile } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🔍 Generating invoice preview:', message.substring(0, 100) + '...');

    // Get current business settings including logo
    const currentBusinessSettings = await getCurrentBusinessSettings(req.merchant.id);

    // Performance optimization: Cache product catalog to avoid database calls
    const catalogCacheKey = getCacheKey('catalog', 'all');
    let catalog = getFromCache(catalogCacheKey);
    
    if (!catalog) {
      const products = await database.getAllProducts(100, 0, null, true, req.merchant.id);
      catalog = products.map(product => ({
        id: `prod_${product.id}`,
        name: product.name,
        description: product.description,
        sku: product.sku,
        category: product.category,
        price: product.unit_price,
        tags: [product.name.toLowerCase(), product.category.toLowerCase(), product.sku.toLowerCase()]
      }));
      
      // Cache the catalog for 5 minutes
      setCache(catalogCacheKey, catalog);
      console.log('📦 Catalog cached for performance');
    } else {
      console.log('📦 Using cached catalog');
    }

    // Use business profile if provided, otherwise use default config
    const currentMerchantConfig = businessProfile ? {
      businessName: businessProfile.name || businessProfile.businessName || currentBusinessSettings.name,
      address: businessProfile.address || currentBusinessSettings.address,
      phone: businessProfile.phone || currentBusinessSettings.phone,
      email: businessProfile.email || currentBusinessSettings.email,
      website: businessProfile.website || currentBusinessSettings.website,
      logo: businessProfile.logo || currentBusinessSettings.logoUrl || config.merchant.logo || "/assets//assets/aspree2-logo.png?v=2",
      category: businessProfile.category || 'general',
      taxId: currentBusinessSettings.taxId,
      paymentTerms: "NET_30",
      catalog: catalog.length > 0 ? catalog : merchantConfig.catalog,
      // Custom business settings
      defaultTaxRate: businessProfile.taxRate || currentBusinessSettings.taxRate || 0,
      additionalNotes: businessProfile.additionalNotes || "",
      hideBusinessName: businessProfile.hideBusinessName !== undefined ? businessProfile.hideBusinessName : currentBusinessSettings.hideBusinessName
    } : {
      ...merchantConfig,
      businessName: currentBusinessSettings.name,
      address: currentBusinessSettings.address,
      phone: currentBusinessSettings.phone,
      hideBusinessName: currentBusinessSettings.hideBusinessName,
      email: currentBusinessSettings.email,
      website: currentBusinessSettings.website,
      logo: currentBusinessSettings.logoUrl || config.merchant.logo || "",
      taxId: currentBusinessSettings.taxId,
      catalog: catalog.length > 0 ? catalog : merchantConfig.catalog,
      category: 'general',
      // Default settings
      defaultTaxRate: currentBusinessSettings.taxRate || 0,
      additionalNotes: ""
    };

    console.log('📦 Using catalog with', catalog.length, 'products');

    // Process the message for PREVIEW ONLY
    const result = await generator.processWhatsAppMessage(
      message,
      currentMerchantConfig,
      null, // No default shipping - extract from message
      "Preview dari web interface"
    );

    if (result.success) {
      console.log('✅ Invoice preview generated successfully:', result.invoice.header.invoiceNumber);
      
      // Check for missing prices and provide helpful feedback
      const itemsWithoutPrice = result.invoice.items.filter(item => 
        item.unitPrice === 0 && item.productName && item.quantity > 0
      );
      
      if (itemsWithoutPrice.length > 0) {
        console.log('⚠️ Warning: Items found without prices:', itemsWithoutPrice.map(item => item.productName));
        
        // Add warning to the result
        result.warnings = result.warnings || [];
        result.warnings.push({
          type: 'missing_prices',
          message: `Beberapa item tidak memiliki harga: ${itemsWithoutPrice.map(item => item.productName).join(', ')}. Tambahkan "harga [nominal]" setelah nama produk untuk mendapatkan total yang akurat.`,
          items: itemsWithoutPrice.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            suggestion: `${item.productName} ${item.quantity}pcs harga [nominal]`
          })),
          helpText: 'Contoh: "lolly 13pcs harga 50000" atau "laptop 1pc harga 15000000"'
        });
      }
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Preview generation completed in ${processingTime}ms`);
      
      // Return preview data (no database save)
      const previewResult = {
        ...result,
        preview: true,
        isPreview: true,
        processingTime: processingTime,
        // Generate temporary preview ID for editing reference
        previewId: `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      res.json(previewResult);
      
    } else {
      console.error('❌ Invoice preview generation failed:', result.error);
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to generate invoice preview'
      });
    }
    
  } catch (error) {
    console.error('💥 Preview generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Preview generation failed: ' + error.message
    });
  }
});

// STAGE 2: Final invoice generation with database save 
app.post('/api/confirm-invoice', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { invoiceData, businessProfile, previewId } = req.body;

    if (!invoiceData || !invoiceData.invoice) {
      return res.status(400).json({
        success: false,
        error: 'Invoice data is required'
      });
    }

    console.log('✅ Confirming invoice for final generation:', invoiceData.invoice.header.invoiceNumber);

    // AI AUTO-LEARNING: DISABLED to prevent product name modifications
    // This was causing "linea 28 sumba" to become "sumba blue jeans" due to AI enhancements
    let autoLearningResults = null;
    console.log('🧠 AI auto-learning disabled - preserving original product names from user input');
    
    // Save invoice to database
    try {
      // Get current business settings to ensure logo is included
      console.log('🔧 Step 1: Getting current business settings...');
      let currentBusinessSettings;
      try {
        currentBusinessSettings = await getCurrentBusinessSettings(req.merchant.id);
        console.log('✅ Business settings retrieved:', {
          hasName: !!currentBusinessSettings.name,
          hasLogoUrl: !!currentBusinessSettings.logoUrl,
          hasAddress: !!currentBusinessSettings.address,
          hasPhone: !!currentBusinessSettings.phone
        });
      } catch (settingsError) {
        console.error('💥 Failed to get business settings:', settingsError);
        throw new Error(`Business settings retrieval failed: ${settingsError.message}`);
      }
      
      // Merge business profile with current settings to ensure logo is included
      const mergedBusinessProfile = businessProfile ? {
        ...businessProfile,
        logoUrl: businessProfile.logoUrl || currentBusinessSettings.logoUrl,
        logo: businessProfile.logo || currentBusinessSettings.logoUrl || '/assets/aspree2-logo.png?v=2',
        hideBusinessName: businessProfile.hideBusinessName !== undefined ? businessProfile.hideBusinessName : currentBusinessSettings.hideBusinessName
      } : {
        name: currentBusinessSettings.name || 'Business Name',
        email: currentBusinessSettings.email || 'business@example.com',
        address: currentBusinessSettings.address || 'Business Address',
        phone: currentBusinessSettings.phone || 'Business Phone',
        website: currentBusinessSettings.website || '',
        logoUrl: currentBusinessSettings.logoUrl || null,
        hideBusinessName: currentBusinessSettings.hideBusinessName || false,
        logo: currentBusinessSettings.logoUrl || '/assets/aspree2-logo.png?v=2',
        taxId: currentBusinessSettings.taxId || '',
        taxRate: currentBusinessSettings.taxRate || 0,
        taxEnabled: currentBusinessSettings.taxEnabled || false,
        taxName: currentBusinessSettings.taxName || 'PPN'
      };
      
      console.log('🔧 Step 2: Business profile merged successfully');
      
      // Include business profile data and set initial payment stage
      const invoiceWithProfile = {
        ...invoiceData.invoice,
        businessProfile: mergedBusinessProfile
      };
      
      console.log('🔧 Step 3: Invoice with profile created, logo path:', mergedBusinessProfile.logo);
      
      // Initialize payment stage based on payment schedule
      if (invoiceWithProfile.paymentSchedule && invoiceWithProfile.paymentSchedule.scheduleType === 'down_payment') {
        invoiceWithProfile.payment_stage = 'down_payment';
        invoiceWithProfile.payment_status = 'pending';
        console.log('🎯 Setting initial payment stage to down_payment for scheduled payment invoice');
      } else {
        invoiceWithProfile.payment_stage = 'full_payment';
        invoiceWithProfile.payment_status = 'pending';
        console.log('🎯 Setting initial payment stage to full_payment for regular invoice');
      }
      
      let savedInvoice;
      const { invoiceId } = req.body; // Check if this is an update
      
      if (invoiceId) {
        // UPDATE existing invoice
        console.log('🔧 Step 4: Updating existing invoice with ID:', invoiceId);
        try {
          savedInvoice = await database.updateInvoice(invoiceId, invoiceWithProfile, req.merchant.id);
          if (!savedInvoice) {
            console.error('❌ Invoice not found for update:', invoiceId);
            return res.status(404).json({
              success: false,
              error: 'Invoice not found for update'
            });
          }
          console.log('✅ Invoice updated successfully:', savedInvoice.invoiceNumber);
        } catch (updateError) {
          console.error('💥 Invoice update failed:', updateError);
          throw new Error(`Invoice update failed: ${updateError.message}`);
        }
      } else {
        // CREATE new invoice
        console.log('🔧 Step 4: Creating new invoice');
        try {
          savedInvoice = await database.saveInvoice(invoiceWithProfile, req.merchant.id);
          console.log('✅ New invoice created successfully:', savedInvoice.invoiceNumber);
        } catch (saveError) {
          console.error('💥 Invoice save failed:', saveError);
          throw new Error(`Invoice save failed: ${saveError.message}`);
        }
      }
      
      console.log('🔧 Step 5: Invoice processing completed, ID:', savedInvoice.id);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Final invoice generation completed in ${processingTime}ms`);
      
      // Update the result with the new invoice number and auto-learning results
      const finalResult = {
        ...invoiceData,
        success: true,
        invoice: {
          ...invoiceData.invoice,
          header: {
            ...invoiceData.invoice.header,
            invoiceNumber: savedInvoice.invoiceNumber
          }
        },
        databaseId: savedInvoice.id,
        customerToken: savedInvoice.customerToken,
        customerPortalUrl: `${config.server.baseUrl}/customer/invoice/${savedInvoice.customerToken}`,
        customerGeneralPortalUrl: `${config.server.baseUrl}/customer`,
        // AI Auto-learning results
        autoLearning: autoLearningResults,
        newCustomerDetected: autoLearningResults?.confirmationsNeeded.some(c => c.type === 'customer') || false,
        newProductDetected: autoLearningResults?.confirmationsNeeded.some(c => c.type === 'product') || false,
        customerData: autoLearningResults?.confirmationsNeeded.find(c => c.type === 'customer')?.data || null,
        productData: autoLearningResults?.confirmationsNeeded.filter(c => c.type === 'product').map(c => c.data) || [],
        processingTime: processingTime,
        finalInvoice: true,
        previewId: previewId // Reference to original preview
      };
      
      // Send response immediately to reduce perceived latency
      res.json(finalResult);
      
      // Queue heavy operations (email sending, PDF generation) for async processing
      heavyOperationQueue.push(async () => {
        try {
          if (savedInvoice.customer_email) {
            console.log('📧 Invoice ready for sharing - email not sent automatically');
            console.log('💡 Use the sharing options to send via email, WhatsApp, or link');
          }
        } catch (error) {
          console.error('💥 Heavy operation error:', error);
        }
      });
      
    } catch (databaseError) {
      console.error('💾 Database operation failed:', databaseError);
      console.error('💾 Stack trace:', databaseError.stack);
      console.error('💾 Error type:', databaseError.constructor.name);
      res.status(500).json({
        success: false,
        error: 'Failed to save invoice: ' + databaseError.message,
        errorType: databaseError.constructor.name
      });
    }
    
  } catch (error) {
    console.error('💥 Final invoice generation error:', error);
    console.error('💥 Stack trace:', error.stack);
    console.error('💥 Error type:', error.constructor.name);
    console.error('💥 Request body keys:', Object.keys(req.body || {}));
    res.status(500).json({
      success: false,
      error: 'Final invoice generation failed: ' + error.message,
      errorType: error.constructor.name
    });
  }
});

// LEGACY: Original process-message API (redirects to preview-only mode)
app.post('/api/process-message', authMiddleware.authenticateMerchant, async (req, res) => {
  console.log('⚠️  Legacy API called - redirecting to preview-only mode');
  console.log('💡 This API now generates previews only. Use /api/confirm-invoice to finalize.');
  
  // Redirect to the new preview API
  try {
    const { message, businessProfile } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🔄 Redirecting to preview-only API...');
    
    // Make internal request to preview API
    const previewResponse = await fetch(`${config.server.baseUrl}/api/preview-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, businessProfile })
    });

    if (!previewResponse.ok) {
      return res.status(previewResponse.status).json({
        success: false,
        error: 'Preview generation failed'
      });
    }

    const previewData = await previewResponse.json();
    
    // Add legacy compatibility flag
    const legacyResponse = {
      ...previewData,
      legacyMode: true,
      message: 'This is a preview only. Use "Generate Final Invoice" button to create the final invoice.'
    };

    res.json(legacyResponse);
    
  } catch (error) {
    console.error('💥 Legacy API redirect error:', error);
    res.status(500).json({
      success: false,
      error: 'Legacy API redirect failed: ' + error.message
    });
  }
});

// PDF generation removed - replaced with Print functionality
/*
app.post('/api/generate-pdf', async (req, res) => {
  const startTime = Date.now();
  try {
    const { invoiceData } = req.body;

    if (!invoiceData) {
      return res.status(400).json({
        success: false,
        error: 'Data faktur diperlukan'
      });
    }

    console.log('📄 Generating PDF for invoice:', invoiceData.invoice.header.invoiceNumber);

    // Performance optimization: Check cache for recently generated PDFs
    const pdfCacheKey = getCacheKey('pdf', invoiceData.invoice.header.invoiceNumber);
    let pdfBuffer = getFromCache(pdfCacheKey);
    
    if (!pdfBuffer) {
      // Generate PDF (with fallback to HTML)
      pdfBuffer = await pdfGenerator.generateInvoicePDF(invoiceData);
      
      // Cache the PDF for 1 minute (shorter TTL for PDFs)
      setCache(pdfCacheKey, pdfBuffer);
      console.log('📄 PDF cached for performance');
    } else {
      console.log('📄 Using cached PDF');
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ PDF generation completed in ${processingTime}ms`);

    // Check if we got HTML fallback instead of PDF
    if (pdfBuffer.isHTML) {
      // Set headers for HTML download
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="Faktur-${invoiceData.invoice.header.invoiceNumber}.html"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      console.log('📄 Generated HTML invoice (fallback mode):', pdfBuffer.fileName);
      res.send(pdfBuffer);
    } else {
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Faktur-${invoiceData.invoice.header.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF buffer
      res.send(pdfBuffer);
      console.log('✅ PDF generated successfully');
    }

  } catch (error) {
    console.error('💥 PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal membuat PDF: ' + error.message
    });
  }
});

// API endpoint to download PDF by invoice ID
app.get('/api/invoices/pdf/:invoiceId', async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    
    // Get invoice from database
    const invoice = await database.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Create invoice data structure for PDF generation
    const invoiceData = {
      invoice: {
        header: {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          status: invoice.status
        },
        merchant: {
          businessName: invoice.merchant_name,
          address: invoice.merchant_address,
          phone: invoice.merchant_phone,
          email: invoice.merchant_email,
          website: invoice.merchant_website || ''
        },
        customer: {
          name: invoice.customer_name,
          email: invoice.customer_email,
          address: invoice.customer_address
        },
        items: invoice.items_json || [],
        calculations: {
          subtotal: invoice.subtotal,
          totalTax: invoice.tax_amount,
          shippingCost: invoice.shipping_cost,
          grandTotal: invoice.grand_total,
          currency: invoice.currency || 'IDR'
        },
        payment: {
          paymentTerms: invoice.payment_terms || 'NET_30',
          paymentMethods: ['Bank Transfer', 'QRIS'],
          notes: invoice.notes || ''
        }
      }
    };
    
    // Generate PDF
    const pdfBuffer = await pdfGenerator.generateInvoicePDF(invoiceData);
    
    // Check if we got HTML fallback instead of PDF
    if (pdfBuffer.isHTML) {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.html"`);
      res.send(pdfBuffer);
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`);
      res.send(pdfBuffer);
    }
    
  } catch (error) {
    console.error('💥 PDF download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF: ' + error.message
    });
  }
});

// API endpoint to generate bulk PDF export of invoices
app.post('/api/export/invoices/pdf', async (req, res) => {
  try {
    const { invoiceIds, dateRange, status } = req.body;
    
    console.log('📄 Starting bulk PDF export for invoices');
    
    let invoices = [];
    
    // Get invoices based on provided criteria
    if (invoiceIds && invoiceIds.length > 0) {
      // Export specific invoices
      invoices = await Promise.all(
        invoiceIds.map(async (id) => {
          const invoice = await database.getInvoice(id);
          return invoice;
        })
      );
      invoices = invoices.filter(Boolean); // Remove null entries
    } else {
      // Export all invoices with filters
      invoices = await database.getAllInvoices();
      
      // Apply date range filter
      if (dateRange && dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        invoices = invoices.filter(invoice => {
          const invoiceDate = new Date(invoice.invoice_date);
          return invoiceDate >= startDate && invoiceDate <= endDate;
        });
      }
      
      // Apply status filter
      if (status && status !== 'all') {
        invoices = invoices.filter(invoice => invoice.status === status);
      }
    }
    
    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No invoices found matching criteria'
      });
    }
    
    console.log(`📄 PDF Export disabled - returning JSON data instead`);
    
    // PDF generation disabled - return JSON data instead
    const reportData = {
      title: 'Invoice Export Report',
      dateRange: dateRange,
      status: status,
      invoices: invoices,
      exportedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'PDF export disabled - returning JSON data',
      data: reportData
    });
    console.log(`✅ JSON report generated: ${invoices.length} invoices`);
    
  } catch (error) {
    console.error('💥 Bulk PDF export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export invoices: ' + error.message
    });
  }
});

// API endpoint to generate comprehensive analytics report
app.post('/api/export/analytics/pdf', async (req, res) => {
  try {
    const { reportType, dateRange, includeCharts = true } = req.body;
    
    console.log('📊 Generating analytics report PDF');
    
    // Gather analytics data
    const invoices = await database.getAllInvoices();
    const orders = await database.getAllOrders();
    const customers = await database.getAllCustomers();
    const products = await database.getAllProducts();
    
    // Filter data by date range if provided
    let filteredInvoices = invoices;
    let filteredOrders = orders;
    
    if (dateRange && dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      filteredInvoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoice_date);
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });
      
      filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate >= startDate && orderDate <= endDate;
      });
    }
    
    // Calculate top products
    const calculateTopProducts = (invoices, products) => {
      const productSales = {};
      
      invoices.forEach(invoice => {
        try {
          const items = JSON.parse(invoice.items_json || '[]');
          items.forEach(item => {
            const key = item.productName || item.name;
            if (!productSales[key]) {
              productSales[key] = { name: key, quantity: 0, revenue: 0 };
            }
            productSales[key].quantity += item.quantity || 0;
            productSales[key].revenue += (item.quantity || 0) * (item.unitPrice || 0);
          });
        } catch (error) {
          console.error('Error parsing items for invoice:', invoice.invoice_number, error);
        }
      });
      
      return Object.values(productSales).sort((a, b) => b.revenue - a.revenue);
    };
    
    // Calculate analytics
    const analytics = {
      revenue: {
        totalRevenue: filteredInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0),
        totalInvoices: filteredInvoices.length,
        avgInvoiceValue: filteredInvoices.length > 0 ? 
          filteredInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0) / filteredInvoices.length : 0,
        paidInvoices: filteredInvoices.filter(inv => inv.status === 'paid').length,
        unpaidInvoices: filteredInvoices.filter(inv => inv.status === 'sent').length,
        overdueInvoices: filteredInvoices.filter(inv => inv.status === 'overdue').length
      },
      customers: {
        totalCustomers: customers.length,
        newCustomers: customers.filter(customer => {
          if (!dateRange) return true;
          const customerDate = new Date(customer.created_at);
          return customerDate >= new Date(dateRange.start) && customerDate <= new Date(dateRange.end);
        }).length,
        repeatCustomers: customers.filter(customer => {
          const customerInvoices = filteredInvoices.filter(inv => inv.customer_email === customer.email);
          return customerInvoices.length > 1;
        }).length
      },
      products: {
        totalProducts: products.length,
        topProducts: calculateTopProducts(filteredInvoices, products).slice(0, 10)
      },
      orders: {
        totalOrders: filteredOrders.length,
        shippedOrders: filteredOrders.filter(order => order.status === 'shipped').length,
        deliveredOrders: filteredOrders.filter(order => order.status === 'delivered').length,
        pendingOrders: filteredOrders.filter(order => order.status === 'pending').length
      },
      dateRange: dateRange,
      generatedAt: new Date().toISOString()
    };
    
    // PDF generation disabled - return JSON analytics data
    const reportData = {
      reportType: reportType || 'comprehensive',
      includeCharts: includeCharts,
      analytics: analytics,
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'PDF export disabled - returning JSON analytics data',
      data: reportData
    });
    console.log('✅ Analytics report JSON generated successfully');
    
  } catch (error) {
    console.error('💥 Analytics report generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics report: ' + error.message
    });
  }
});
*/

// API endpoint to get export status and options
app.get('/api/export/options', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const invoices = await database.getAllInvoices(1000, 0, null, null, null, null, req.merchant.id);
    const customers = await database.getAllCustomers(1000, 0, null, req.merchant.id);
    const products = await database.getAllProducts(1000, 0, null, true, req.merchant.id);
    
    res.json({
      success: true,
      exportOptions: {
        invoices: {
          total: invoices.length,
          formats: ['pdf', 'csv', 'xlsx'],
          bulkOptions: ['single'],
          filters: ['dateRange', 'status', 'customer']
        },
        customers: {
          total: customers.length,
          formats: ['csv', 'xlsx', 'pdf']
        },
        products: {
          total: products.length,
          formats: ['csv', 'xlsx', 'pdf']
        },
        analytics: {
          reportTypes: ['comprehensive', 'revenue', 'customers', 'products'],
          formats: ['pdf', 'xlsx'],
          chartOptions: ['includeCharts', 'chartsOnly']
        }
      }
    });
  } catch (error) {
    console.error('Error fetching export options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch export options'
    });
  }
});

// API endpoint to send invoice by email
app.post('/api/invoices/send-email', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { invoiceId, customerEmail, businessProfile } = req.body;
    
    if (!invoiceId || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Invoice ID and customer email are required'
      });
    }
    
    // Get invoice from database
    const invoice = await database.getInvoice(invoiceId, req.merchant.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    console.log('📧 Sending invoice email for:', invoice.invoice_number);
    
    // Send email without PDF attachment
    // Use the merchant data from the invoice itself to ensure consistency
    // Include logo from business profile if available
    const currentBusinessSettings = await getCurrentBusinessSettings(req.merchant.id);
    const businessSettings = {
      name: invoice.merchant_name,
      email: invoice.merchant_email,
      address: invoice.merchant_address,
      phone: invoice.merchant_phone,
      website: currentBusinessSettings.website,
      taxId: currentBusinessSettings.taxId,
      logo: businessProfile?.logo || currentBusinessSettings.logoUrl || '/assets/aspree2-logo.png?v=2',
      category: businessProfile?.category || 'general'
    };
    await emailService.sendInvoiceEmail(invoice, customerEmail, null, businessSettings);
    
    res.json({
      success: true,
      message: 'Invoice sent successfully'
    });
    
  } catch (error) {
    console.error('💥 Email send error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email: ' + error.message
    });
  }
});

// API endpoint to send final payment email
app.post('/api/final-payment/send-email', async (req, res) => {
  try {
    const { invoiceId, customerEmail, businessProfile } = req.body;
    
    if (!invoiceId || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Invoice ID and customer email are required'
      });
    }

    const invoice = await database.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Check if invoice has final payment token and is in correct stage
    if (invoice.payment_stage !== 'final_payment' || !invoice.final_payment_token) {
      return res.status(400).json({
        success: false,
        error: 'Invoice is not in final payment stage or missing payment token'
      });
    }
    
    console.log('📧 Sending final payment email for:', invoice.invoice_number);
    
    // Construct final payment URL
    const finalPaymentUrl = `${req.protocol}://${req.get('host')}/final-payment?token=${invoice.final_payment_token}`;
    
    // Use the merchant data from the invoice itself to ensure consistency
    // Include logo from business profile if available
    const currentBusinessSettings = await getCurrentBusinessSettings(req.merchant.id);
    const businessSettings = {
      name: invoice.merchant_name,
      email: invoice.merchant_email,
      address: invoice.merchant_address,
      phone: invoice.merchant_phone,
      website: currentBusinessSettings.website,
      taxId: currentBusinessSettings.taxId,
      logo: businessProfile?.logo || currentBusinessSettings.logoUrl || '/assets/aspree2-logo.png?v=2',
      category: businessProfile?.category || 'general'
    };
    
    const emailResult = await emailService.sendFinalPaymentEmail(invoice, customerEmail, finalPaymentUrl, businessSettings);
    
    res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Final payment email sent successfully' : 'Failed to send final payment email',
      error: emailResult.error || null,
      messageId: emailResult.messageId || null
    });
    
  } catch (error) {
    console.error('💥 Final payment email send error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send final payment email: ' + error.message
    });
  }
});

// Email Notification API endpoints
app.post('/api/notifications/payment-reminder', async (req, res) => {
  try {
    const { invoiceId, daysToDue } = req.body;
    
    if (!invoiceId || daysToDue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Invoice ID and daysToDue are required'
      });
    }
    
    // Get invoice from database
    const invoice = await database.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Send payment reminder email
    const result = await emailService.sendPaymentReminderEmail(
      invoice,
      invoice.customer_email,
      daysToDue
    );
    
    res.json(result);
  } catch (error) {
    console.error('💥 Payment reminder error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/notifications/invoice-overdue', async (req, res) => {
  try {
    const { invoiceId, daysPastDue } = req.body;
    
    if (!invoiceId || daysPastDue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Invoice ID and daysPastDue are required'
      });
    }
    
    // Get invoice from database
    const invoice = await database.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Send overdue notification email
    const result = await emailService.sendInvoiceOverdueNotification(
      invoice,
      invoice.customer_email,
      daysPastDue
    );
    
    res.json(result);
  } catch (error) {
    console.error('💥 Overdue notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/notifications/order-shipped', async (req, res) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }
    
    // Get order from database (using existing orders structure)
    const order = await database.getOrder(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Send shipping notification email
    const result = await emailService.sendOrderShippedNotification(
      order,
      order.customer_email
    );
    
    res.json(result);
  } catch (error) {
    console.error('💥 Shipping notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/notifications/order-delivered', async (req, res) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }
    
    // Get order from database
    const order = await database.getOrder(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Send delivery notification email
    const result = await emailService.sendOrderDeliveredNotification(
      order,
      order.customer_email
    );
    
    res.json(result);
  } catch (error) {
    console.error('💥 Delivery notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/notifications/merchant', async (req, res) => {
  try {
    const { type, data, merchantEmail } = req.body;
    
    if (!type || !data || !merchantEmail) {
      return res.status(400).json({
        success: false,
        error: 'Type, data, and merchantEmail are required'
      });
    }
    
    // Send merchant notification email
    const result = await emailService.sendMerchantNotification(
      type,
      data,
      merchantEmail
    );
    
    res.json(result);
  } catch (error) {
    console.error('💥 Merchant notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI Auto-learning API endpoints
app.post('/api/auto-learning/confirm-customer', async (req, res) => {
  try {
    const { customerData, action } = req.body;
    
    if (!customerData || !action) {
      return res.status(400).json({
        success: false,
        error: 'Customer data and action are required'
      });
    }

    if (action === 'add') {
      await database.findOrCreateCustomer(customerData, merchantId);
      console.log('✅ Customer manually confirmed and added:', customerData.name);
      
      res.json({
        success: true,
        message: 'Customer added successfully',
        customer: customerData
      });
    } else if (action === 'skip') {
      console.log('⏭️ Customer addition skipped for:', customerData.name);
      
      res.json({
        success: true,
        message: 'Customer addition skipped'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use "add" or "skip"'
      });
    }

  } catch (error) {
    console.error('❌ Error confirming customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process customer confirmation: ' + error.message
    });
  }
});

app.post('/api/auto-learning/confirm-product', async (req, res) => {
  try {
    const { productData, action } = req.body;
    
    if (!productData || !action) {
      return res.status(400).json({
        success: false,
        error: 'Product data and action are required'
      });
    }

    if (action === 'add') {
      await database.createProduct(productData);
      console.log('✅ Product manually confirmed and added:', productData.name);
      
      res.json({
        success: true,
        message: 'Product added successfully',
        product: productData
      });
    } else if (action === 'skip') {
      console.log('⏭️ Product addition skipped for:', productData.name);
      
      res.json({
        success: true,
        message: 'Product addition skipped'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use "add" or "skip"'
      });
    }

  } catch (error) {
    console.error('❌ Error confirming product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process product confirmation: ' + error.message
    });
  }
});

app.post('/api/auto-learning/edit-customer', async (req, res) => {
  try {
    const { customerData } = req.body;
    
    if (!customerData) {
      return res.status(400).json({
        success: false,
        error: 'Customer data is required'
      });
    }

    await database.findOrCreateCustomer(customerData, merchantId);
    console.log('✅ Customer edited and added:', customerData.name);
    
    res.json({
      success: true,
      message: 'Customer edited and added successfully',
      customer: customerData
    });

  } catch (error) {
    console.error('❌ Error editing customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to edit customer: ' + error.message
    });
  }
});

app.post('/api/auto-learning/edit-product', async (req, res) => {
  try {
    const { productData } = req.body;
    
    if (!productData) {
      return res.status(400).json({
        success: false,
        error: 'Product data is required'
      });
    }

    await database.createProduct(productData);
    console.log('✅ Product edited and added:', productData.name);
    
    res.json({
      success: true,
      message: 'Product edited and added successfully',
      product: productData
    });

  } catch (error) {
    console.error('❌ Error editing product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to edit product: ' + error.message
    });
  }
});

// API endpoint to get merchant catalog
app.get('/api/catalog', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const products = await database.getAllProducts(100, 0, null, true, req.merchant.id);
    
    // Convert database products to catalog format for compatibility
    const catalog = products.map(product => ({
      id: `prod_${product.id}`,
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: product.category,
      price: product.unit_price,
      tags: [product.name.toLowerCase(), product.category.toLowerCase(), product.sku.toLowerCase()]
    }));
    
    res.json({
      success: true,
      catalog: catalog
    });
  } catch (error) {
    console.error('Error fetching catalog:', error);
    // Fallback to static catalog if database fails
    res.json({
      success: true,
      catalog: merchantConfig.catalog
    });
  }
});

// Invoice Management API Endpoints
app.get('/api/invoices', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, customerEmail, dateFrom, dateTo } = req.query;
    const invoices = await database.getAllInvoices(
      parseInt(limit), 
      parseInt(offset), 
      status, 
      customerEmail,
      dateFrom,
      dateTo,
      req.merchant.id
    );
    
    res.json({
      success: true,
      invoices,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: invoices.length
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices'
    });
  }
});

// Invoice statistics endpoint
app.get('/api/invoices/statistics', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log(`📊 Fetching invoice statistics for merchant ${req.merchant.id}`);

    // Get all invoices for the merchant to calculate statistics
    const invoices = await database.getAllInvoices(
      10000, // High limit to get all invoices
      0,
      null,
      null,
      null,
      null,
      req.merchant.id
    );

    // Calculate statistics
    const stats = {
      totalInvoices: invoices.length,
      pendingInvoices: invoices.filter(inv => inv.status === 'pending').length,
      sentInvoices: invoices.filter(inv => inv.status === 'sent').length,
      paidInvoices: invoices.filter(inv => inv.payment_status === 'paid').length,
      unpaidInvoices: invoices.filter(inv => inv.payment_status === 'pending').length,
      overdue: invoices.filter(inv => {
        if (!inv.due_date || inv.payment_status === 'paid') return false;
        return new Date(inv.due_date) < new Date();
      }).length,
      totalRevenue: invoices
        .filter(inv => inv.payment_status === 'paid')
        .reduce((sum, inv) => sum + (parseFloat(inv.grand_total) || 0), 0),
      pendingRevenue: invoices
        .filter(inv => inv.payment_status === 'pending')
        .reduce((sum, inv) => sum + (parseFloat(inv.grand_total) || 0), 0),
      averageInvoiceValue: invoices.length > 0
        ? invoices.reduce((sum, inv) => sum + (parseFloat(inv.grand_total) || 0), 0) / invoices.length
        : 0
    };

    console.log(`📊 Statistics for merchant ${req.merchant.id}:`, {
      total: stats.totalInvoices,
      paid: stats.paidInvoices,
      revenue: stats.totalRevenue
    });

    res.json({
      success: true,
      statistics: stats,
      merchantId: req.merchant.id
    });

  } catch (error) {
    console.error('Error fetching invoice statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice statistics'
    });
  }
});

app.get('/api/invoices/:id', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const idParam = req.params.id;
    let invoice;
    
    console.log('🔒 Invoice access attempt for ID:', idParam);
    console.log('🔒 Request merchant:', req.merchant?.id || 'anonymous');
    console.log('🔒 Request source IP:', req.ip);
    
    // Check if the parameter is a numeric ID or an invoice number
    if (/^\d+$/.test(idParam)) {
      // Numeric ID - use original method
      console.log('🔍 Loading invoice by numeric ID:', parseInt(idParam));
      invoice = await database.getInvoice(parseInt(idParam));
    } else {
      // Invoice number - use invoice number lookup
      console.log('🔍 Loading invoice by invoice number:', idParam);
      invoice = await database.getInvoiceByNumber(idParam);
    }
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    console.log('🔒 Invoice found with merchant_id:', invoice.merchant_id);
    
    // SECURITY CHECK: If request is from an authenticated merchant, ensure they can only access their own invoices
    if (req.merchant && req.merchant.id !== invoice.merchant_id) {
      console.log('🚨 SECURITY: Merchant', req.merchant.id, 'attempted to access invoice belonging to merchant', invoice.merchant_id);
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only view your own invoices'
      });
    }
    
    console.log('🔒 Access validated - Invoice details:', {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      merchant_id: invoice.merchant_id,
      accessing_merchant: req.merchant?.id || 'public',
      access_type: req.merchant ? 'merchant' : 'public'
    });

    // Get current business settings for the invoice's merchant to ensure consistent display
    const currentBusinessSettings = await getCurrentBusinessSettings(invoice.merchant_id);
    console.log('✅ Business settings loaded for merchant_id', invoice.merchant_id);
    
    // Data consistency check
    if (currentBusinessSettings.email && currentBusinessSettings.email !== invoice.merchant_email) {
      console.log('⚠️  Data inconsistency detected between invoice and business settings for merchant', invoice.merchant_id);
    }
    
    // Enhance invoice with business settings for consistent template rendering
    const enhancedInvoice = {
      ...invoice,
      // Ensure business information is available
      merchant_logo: currentBusinessSettings.logoUrl || invoice.merchant_logo,
      merchant_name: invoice.merchant_name || currentBusinessSettings.name,
      merchant_address: invoice.merchant_address || currentBusinessSettings.address,
      merchant_phone: invoice.merchant_phone || currentBusinessSettings.phone,
      merchant_email: invoice.merchant_email || currentBusinessSettings.email,
      merchant_website: invoice.merchant_website || currentBusinessSettings.website,
      
      // Add metadata for business profile (needed for template logic)
      businessProfile: {
        name: invoice.merchant_name || currentBusinessSettings.name,
        address: invoice.merchant_address || currentBusinessSettings.address,
        phone: invoice.merchant_phone || currentBusinessSettings.phone,
        email: invoice.merchant_email || currentBusinessSettings.email,
        website: invoice.merchant_website || currentBusinessSettings.website,
        logo: currentBusinessSettings.logoUrl || invoice.merchant_logo,
        logoUrl: currentBusinessSettings.logoUrl || invoice.merchant_logo, // Ensure both fields are set for compatibility
        hideBusinessName: currentBusinessSettings.hideBusinessName || false,
        taxEnabled: currentBusinessSettings.taxEnabled || false,
        taxRate: currentBusinessSettings.taxRate || 0,
        termsAndConditions: currentBusinessSettings.termsAndConditions || 'Pembayaran dalam 30 hari'
      }
    };
    
    console.log('📄 Enhanced invoice data for consistent display:', {
      invoice_number: enhancedInvoice.invoice_number,
      hasLogo: !!enhancedInvoice.merchant_logo,
      hasBusinessProfile: !!enhancedInvoice.businessProfile
    });
    
    res.json({
      success: true,
      invoice: enhancedInvoice
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice'
    });
  }
});

// Get payment confirmations for an invoice
app.get('/api/invoices/:id/payment-confirmations', authMiddleware.authenticateMerchant, async (req, res) => {
  console.log(`🔍 Payment confirmations request for invoice: ${req.params.id}`);
  
  try {
    const invoiceId = parseInt(req.params.id);
    console.log(`📋 Parsed invoice ID: ${invoiceId}`);
    
    // Step 1: Get invoice from database
    console.log('🔄 Fetching invoice from database...');
    const invoice = await database.getInvoice(invoiceId, req.merchant.id);
    console.log(`📊 Invoice data received:`, invoice ? 'Found' : 'Not found');
    
    if (!invoice) {
      console.log('❌ Invoice not found in database');
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    console.log('✅ Invoice found, checking payment confirmation fields...');
    console.log(`  - payment_confirmation_file: ${invoice.payment_confirmation_file || 'NOT SET'}`);
    console.log(`  - confirmation_status: ${invoice.confirmation_status || 'NOT SET'}`);
    console.log(`  - payment_confirmation_date: ${invoice.payment_confirmation_date || 'NOT SET'}`);
    console.log(`  - payment_confirmation_notes: ${invoice.payment_confirmation_notes || 'NOT SET'}`);
    
    // Step 2: Build payment confirmations array from invoice data
    const confirmations = [];
    
    if (invoice.payment_confirmation_file) {
      console.log('🔄 Processing payment confirmation file...');
      
      try {
        // Fix Windows file path to web-accessible path through API endpoint
        let webPath = invoice.payment_confirmation_file;
        
        // Extract just the filename from the full path
        const filename = webPath.split(/[\\\/]/).pop();
        
        // Use the API endpoint to serve the file
        webPath = `/api/payment-confirmations/${filename}`;
        console.log(`📁 Original path: ${invoice.payment_confirmation_file}`);
        console.log(`🌐 Web path: ${webPath}`);
        
        const confirmation = {
          id: 1, // Simple ID for now
          filePath: webPath,
          originalName: invoice.payment_confirmation_file.split(/[\\\/]/).pop(),
          notes: invoice.payment_confirmation_notes || '',
          uploadDate: invoice.payment_confirmation_date || invoice.updated_at,
          status: invoice.confirmation_status || 'pending',
          paymentType: invoice.paymentType || 'regular'
        };
        
        console.log('✅ Payment confirmation object created:', confirmation);
        confirmations.push(confirmation);
      } catch (confirmationError) {
        console.error('❌ Error processing payment confirmation:', confirmationError);
        throw confirmationError;
      }
    } else {
      console.log('ℹ️ No payment confirmation file found for this invoice');
    }
    
    console.log(`📤 Returning ${confirmations.length} payment confirmation(s)`);
    res.json({
      success: true,
      confirmations: confirmations
    });
    
  } catch (error) {
    console.error('❌ Error fetching payment confirmations:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment confirmations',
      details: error.message
    });
  }
});

// Approve payment confirmation
app.put('/api/invoices/:id/payment-confirmations/approve', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { merchantNotes } = req.body;
    
    const result = await database.updatePaymentConfirmationStatus(invoiceId, 'approved', merchantNotes || '');
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Check if an order was automatically created
    let message = 'Payment confirmation approved successfully';
    if (result.orderCreated) {
      message += ` and order ${result.orderNumber} was created automatically`;
    } else if (result.orderError) {
      message += `, but order creation failed: ${result.orderError}`;
    }

    res.json({
      success: true,
      message: message,
      invoice: result,
      orderCreated: result.orderCreated || false,
      orderId: result.orderId || null,
      orderNumber: result.orderNumber || null
    });
    
  } catch (error) {
    console.error('Error approving payment confirmation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve payment confirmation'
    });
  }
});

// Reject payment confirmation
app.put('/api/invoices/:id/payment-confirmations/reject', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { merchantNotes } = req.body;
    
    const result = await database.updatePaymentConfirmationStatus(invoiceId, 'rejected', merchantNotes || '');
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Payment confirmation rejected',
      invoice: result
    });
    
  } catch (error) {
    console.error('Error rejecting payment confirmation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject payment confirmation'
    });
  }
});

app.get('/api/invoices/number/:invoiceNumber', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.merchant.id;
    const invoiceNumber = req.params.invoiceNumber;
    
    console.log(`🔍 Fetching invoice ${invoiceNumber} for merchant ${merchantId}`);
    
    // Get invoice with merchant isolation
    const invoice = await database.getInvoiceByNumber(invoiceNumber, merchantId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('❌ Error fetching invoice by number:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice: ' + error.message
    });
  }
});

// Sync paid invoices to orders (creates missing orders for paid invoices)
app.post('/api/orders/sync-from-invoices', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log(`🔄 Syncing paid invoices to orders for merchant ${req.merchant.id}`);

    // Get all paid invoices for this merchant
    const paidInvoices = await database.getInvoices(req.merchant.id, { status: 'paid' });

    if (!Array.isArray(paidInvoices) || paidInvoices.length === 0) {
      return res.json({
        success: true,
        message: 'No paid invoices found',
        processed: 0,
        created: 0
      });
    }

    // Get existing orders to check which invoices already have orders
    const existingOrders = await database.getOrders(req.merchant.id);
    const existingOrderInvoiceIds = new Set(
      existingOrders.map(order => order.source_invoice_id).filter(Boolean)
    );

    // Find paid invoices without corresponding orders
    const invoicesNeedingOrders = paidInvoices.filter(invoice =>
      !existingOrderInvoiceIds.has(invoice.id)
    );

    console.log(`📊 Found ${paidInvoices.length} paid invoices, ${invoicesNeedingOrders.length} need orders`);

    let createdCount = 0;
    const errors = [];

    // Create orders for invoices that don't have them
    for (const invoice of invoicesNeedingOrders) {
      try {
        const orderResult = await database.createOrderFromInvoice(invoice.id, req.merchant.id);
        console.log(`✅ Created order ${orderResult.orderNumber} for invoice ${invoice.invoice_number}`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Failed to create order for invoice ${invoice.invoice_number}:`, error.message);
        errors.push({
          invoiceNumber: invoice.invoice_number,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Sync completed: ${createdCount} orders created`,
      processed: invoicesNeedingOrders.length,
      created: createdCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing invoices to orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync invoices to orders: ' + error.message
    });
  }
});

app.put('/api/invoices/:id/status', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { status } = req.body;
    console.log(`🔄 Updating invoice ${req.params.id} status to '${status}' for merchant ${req.merchant.id}`);

    if (!['draft', 'sent', 'paid'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be draft, sent, or paid'
      });
    }

    const result = await database.updateInvoiceStatus(parseInt(req.params.id), status, req.merchant.id);

    // Check if order was created (if status was updated to paid)
    let orderInfo = null;
    if (status === 'paid') {
      console.log('📊 Payment status update result:', {
        hasResult: !!result,
        orderCreated: result?.orderCreated,
        orderId: result?.orderId,
        orderNumber: result?.orderNumber,
        orderError: result?.orderError
      });

      if (result && result.orderCreated) {
        orderInfo = {
          orderCreated: true,
          orderId: result.orderId,
          orderNumber: result.orderNumber
        };
        console.log(`✅ Order ${result.orderNumber} successfully created from paid invoice ${req.params.id}`);
      } else if (result && result.orderError) {
        orderInfo = {
          orderCreated: false,
          orderError: result.orderError
        };
        console.warn(`⚠️ Order creation failed for invoice ${req.params.id}: ${result.orderError}`);
      } else {
        orderInfo = {
          orderCreated: false
        };
        console.warn(`⚠️ No order creation info returned for paid invoice ${req.params.id}`);
      }
    }

    const responseMessage = `Invoice status updated to ${status}${orderInfo?.orderCreated ? ` and order ${orderInfo.orderNumber} created` : ''}`;

    res.json({
      success: true,
      message: responseMessage,
      result,
      ...orderInfo
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update invoice status'
    });
  }
});

// Payment stage management
app.put('/api/invoices/:id/payment-stage', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { action, status } = req.body;
    const invoiceId = parseInt(req.params.id);
    
    console.log(`🎯 Payment stage action: ${action} for invoice ${invoiceId}`);
    
    if (!['confirm_down_payment', 'confirm_final_payment'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be confirm_down_payment or confirm_final_payment'
      });
    }
    
    // Get current invoice to check payment stage
    const invoice = await database.getInvoice(invoiceId, req.merchant.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    let newStage, newStatus, message;
    
    if (action === 'confirm_down_payment') {
      if (invoice.payment_stage !== 'down_payment') {
        return res.status(400).json({
          success: false,
          error: 'Invoice is not in down payment stage'
        });
      }
      newStage = 'final_payment';
      newStatus = 'partial';
      message = 'Down payment confirmed, moved to final payment stage';
    } else if (action === 'confirm_final_payment') {
      if (invoice.payment_stage !== 'final_payment') {
        return res.status(400).json({
          success: false,
          error: 'Invoice is not in final payment stage'
        });
      }
      newStage = 'completed';
      newStatus = 'completed';
      message = 'Final payment confirmed, invoice completed';
    }
    
    // Update the payment stage
    const result = await database.updatePaymentStage(invoiceId, newStage, newStatus);
    
    res.json({
      success: true,
      message: message,
      paymentStage: newStage,
      paymentStatus: newStatus,
      result
    });
  } catch (error) {
    console.error('Error updating payment stage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment stage: ' + error.message
    });
  }
});

app.delete('/api/invoices/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const result = await database.deleteInvoice(parseInt(req.params.id), req.merchant.id);
    res.json({
      success: true,
      message: 'Invoice deleted successfully',
      result
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete invoice'
    });
  }
});

// Bulk delete invoices endpoint
app.post('/api/invoices/bulk-delete', async (req, res) => {
  try {
    const { invoiceIds } = req.body;
    
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invoiceIds array provided'
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const invoiceId of invoiceIds) {
      try {
        await database.deleteInvoice(parseInt(invoiceId));
        results.push({ invoiceId, success: true });
        successCount++;
      } catch (error) {
        results.push({ invoiceId, success: false, error: error.message });
        errorCount++;
      }
    }

    res.json({
      success: errorCount === 0,
      message: `Successfully deleted ${successCount} invoice(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
      results,
      summary: {
        total: invoiceIds.length,
        successful: successCount,
        failed: errorCount
      }
    });
  } catch (error) {
    console.error('Error in bulk delete invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete invoices'
    });
  }
});

// Customer Portal API Endpoints
app.get('/api/customer/invoice/:token', async (req, res) => {
  try {
    const invoice = await database.getInvoiceByCustomerToken(req.params.token);
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    if (!invoice) {
      // Log failed access attempt
      await database.logAccess({
        ip: clientIP,
        userAgent: userAgent,
        type: 'token',
        email: null,
        invoiceId: null,
        success: false
      });
      
      return res.status(404).json({
        success: false,
        error: 'Invoice not found or invalid token'
      });
    }
    
    // Log successful access
    await database.logAccess({
      ip: clientIP,
      userAgent: userAgent,
      type: 'token',
      email: invoice.customer_email,
      invoiceId: invoice.id,
      success: true
    });
    
    // Get current business settings to ensure consistent display (same as main invoice endpoint)
    const currentBusinessSettings = await getCurrentBusinessSettings(req.merchant.id);
    
    // Enhance invoice with business settings for consistent template rendering
    const enhancedInvoice = {
      ...invoice,
      // Ensure business information is available
      merchant_logo: currentBusinessSettings.logoUrl || invoice.merchant_logo,
      merchant_name: invoice.merchant_name || currentBusinessSettings.name,
      merchant_address: invoice.merchant_address || currentBusinessSettings.address,
      merchant_phone: invoice.merchant_phone || currentBusinessSettings.phone,
      merchant_email: invoice.merchant_email || currentBusinessSettings.email,
      merchant_website: invoice.merchant_website || currentBusinessSettings.website,
      
      // Add metadata for business profile (needed for template logic)
      businessProfile: {
        name: invoice.merchant_name || currentBusinessSettings.name,
        address: invoice.merchant_address || currentBusinessSettings.address,
        phone: invoice.merchant_phone || currentBusinessSettings.phone,
        email: invoice.merchant_email || currentBusinessSettings.email,
        website: invoice.merchant_website || currentBusinessSettings.website,
        logo: currentBusinessSettings.logoUrl || invoice.merchant_logo,
        logoUrl: currentBusinessSettings.logoUrl || invoice.merchant_logo, // Ensure both fields are set for compatibility
        hideBusinessName: currentBusinessSettings.hideBusinessName || false,
        taxEnabled: currentBusinessSettings.taxEnabled || false,
        taxRate: currentBusinessSettings.taxRate || 0,
        termsAndConditions: currentBusinessSettings.termsAndConditions || 'Pembayaran dalam 30 hari'
      }
    };
    
    console.log('📄 Enhanced customer invoice data for consistent display:', {
      invoice_number: enhancedInvoice.invoice_number,
      token: req.params.token,
      hasLogo: !!enhancedInvoice.merchant_logo,
      hasBusinessProfile: !!enhancedInvoice.businessProfile
    });
    
    res.json({
      success: true,
      invoice: enhancedInvoice
    });
  } catch (error) {
    console.error('Error fetching customer invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice'
    });
  }
});

app.get('/api/customer/invoices/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const invoices = await database.getCustomerInvoices(email);
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Log access attempt
    await database.logAccess({
      ip: clientIP,
      userAgent: userAgent,
      type: 'email',
      email: email,
      invoiceId: null,
      success: invoices.length > 0
    });
    
    res.json({
      success: true,
      invoices
    });
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer invoices'
    });
  }
});

// Product Management API Endpoints
app.post('/api/products', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('Creating product with data:', req.body);
    
    // Validate required fields
    if (!req.body.name || !req.body.sku || !req.body.unit_price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, sku, and unit_price are required'
      });
    }
    
    const result = await database.createProduct(req.body, req.merchant.id);
    console.log('Product created successfully:', result);
    
    res.json({
      success: true,
      message: 'Product created successfully',
      productId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error creating product:', error);
    let errorMessage = 'Failed to create product';
    
    if (error.message.includes('UNIQUE constraint failed')) {
      errorMessage = 'Product SKU already exists';
    } else if (error.message.includes('NOT NULL constraint failed')) {
      errorMessage = 'Missing required field';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage + ': ' + error.message
    });
  }
});

app.get('/api/products', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { limit = 50, offset = 0, category, active_only = 'true' } = req.query;
    const products = await database.getAllProducts(
      parseInt(limit),
      parseInt(offset),
      category,
      active_only === 'true',
      req.merchant.id
    );
    
    res.json({
      success: true,
      products,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: products.length
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

app.get('/api/products/categories', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const categories = await database.getProductCategories(req.merchant.id);
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

app.get('/api/products/low-stock', async (req, res) => {
  try {
    const products = await database.getLowStockProducts();
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch low stock products'
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await database.getProduct(parseInt(req.params.id));
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

app.put('/api/products/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const result = await database.updateProduct(parseInt(req.params.id), req.body, req.merchant.id);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
});

app.delete('/api/products/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const result = await database.deleteProduct(parseInt(req.params.id), req.merchant.id);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
});

app.put('/api/products/:id/stock', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { quantity, operation = 'set' } = req.body;
    const result = await database.updateProductStock(parseInt(req.params.id), quantity, operation);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product stock updated successfully'
    });
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product stock'
    });
  }
});

// Order Management API Endpoints
app.post('/api/orders', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('Creating order with data:', req.body);
    
    // Validate required fields
    if (!req.body.customer_name || !req.body.customer_email || !req.body.total_amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customer_name, customer_email, and total_amount are required'
      });
    }
    
    const result = await database.createOrder(req.body, req.merchant.id);
    console.log('Order created successfully:', result);
    
    res.json({
      success: true,
      message: 'Order created successfully',
      orderId: result.lastInsertRowid,
      orderNumber: result.orderNumber
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order: ' + error.message
    });
  }
});

app.get('/api/orders', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      status, 
      customerEmail, 
      dateFrom, 
      dateTo 
    } = req.query;
    
    const orders = await database.getAllOrders(
      parseInt(limit),
      parseInt(offset),
      status,
      customerEmail,
      dateFrom,
      dateTo,
      req.merchant.id
    );
    
    res.json({
      success: true,
      orders,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: orders.length
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Order stats route (must come before :id route)
app.get('/api/orders/stats', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await database.getOrderStats(dateFrom, dateTo, req.merchant.id);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics'
    });
  }
});

app.get('/api/orders/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log(`🔍 Getting order ${req.params.id} for merchant ${req.merchant.id}`);

    const order = await database.getOrder(parseInt(req.params.id), req.merchant.id);
    if (!order) {
      console.log(`❌ Order ${req.params.id} not found or access denied for merchant ${req.merchant.id}`);
      return res.status(404).json({
        success: false,
        error: 'Order not found or access denied'
      });
    }

    console.log(`✅ Order ${req.params.id} retrieved successfully for merchant ${req.merchant.id}`);
    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error(`❌ Error getting order ${req.params.id} for merchant ${req.merchant.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

app.put('/api/orders/:id/status', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { status, tracking_number, notes } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'invoiced'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    const result = await database.updateOrderStatus(parseInt(req.params.id), status, tracking_number, notes, req.merchant.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

app.put('/api/orders/bulk/status', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { orderIds, status, tracking_number } = req.body;
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'orderIds must be a non-empty array'
      });
    }
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'invoiced'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    const additionalData = {};
    if (tracking_number) additionalData.tracking_number = tracking_number;
    
    const result = await database.bulkUpdateOrderStatus(orderIds, status, additionalData);
    
    res.json({
      success: true,
      message: `${result.changes} orders updated to ${status}`,
      updatedCount: result.changes
    });
  } catch (error) {
    console.error('Error bulk updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update order status'
    });
  }
});

app.delete('/api/orders/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log(`🗑️ Deleting order ${req.params.id} for merchant ${req.merchant.id}`);

    const result = await database.deleteOrder(parseInt(req.params.id), req.merchant.id);
    
    if (result.changes === 0) {
      console.log(`❌ Order ${req.params.id} not found or access denied for merchant ${req.merchant.id}`);
      return res.status(404).json({
        success: false,
        error: 'Order not found or access denied'
      });
    }

    console.log(`✅ Order ${req.params.id} deleted successfully for merchant ${req.merchant.id}`);
    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error(`❌ Error deleting order ${req.params.id} for merchant ${req.merchant.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete order'
    });
  }
});

app.post('/api/orders/:id/convert-to-invoice', async (req, res) => {
  try {
    const invoice = await database.convertOrderToInvoice(parseInt(req.params.id));
    
    res.json({
      success: true,
      message: 'Order converted to invoice successfully',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerToken: invoice.customerToken
      }
    });
  } catch (error) {
    console.error('Error converting order to invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert order to invoice: ' + error.message
    });
  }
});

app.post('/api/orders/seed', async (req, res) => {
  try {
    const sampleOrders = [
      {
        customer_name: "John Doe",
        customer_email: "john@example.com", 
        customer_phone: "+62 812 3456 7890",
        shipping_address: "Jl. Merdeka No. 123, Jakarta",
        billing_address: "Jl. Merdeka No. 123, Jakarta",
        status: "pending",
        subtotal: 16500000,
        tax_amount: 1815000,
        shipping_cost: 15000,
        total_amount: 18330000,
        notes: "Rush order",
        items: [
          {
            product_id: 1,
            product_name: "iPhone 15 Pro",
            sku: "IPHONE15PRO",
            quantity: 1,
            unit_price: 16500000,
            line_total: 16500000
          }
        ]
      },
      {
        customer_name: "Jane Smith",
        customer_email: "jane@example.com",
        customer_phone: "+62 813 9876 5432", 
        shipping_address: "Jl. Sudirman No. 456, Bandung",
        billing_address: "Jl. Sudirman No. 456, Bandung",
        status: "processing",
        subtotal: 5000,
        tax_amount: 550,
        shipping_cost: 15000,
        total_amount: 20550,
        notes: "Gift wrapping requested",
        items: [
          {
            product_id: 5,
            product_name: "Lolly",
            sku: "LOLLY001",
            quantity: 1,
            unit_price: 5000,
            line_total: 5000
          }
        ]
      },
      {
        customer_name: "Ahmad Rahman", 
        customer_email: "ahmad@example.com",
        customer_phone: "+62 821 1122 3344",
        shipping_address: "Jl. Thamrin No. 789, Surabaya",
        billing_address: "Jl. Thamrin No. 789, Surabaya",
        status: "shipped",
        subtotal: 4925000,
        tax_amount: 541750,
        shipping_cost: 25000,
        total_amount: 5491750,
        tracking_number: "TRK123456789",
        notes: "Express shipping",
        items: [
          {
            product_id: 3,
            product_name: "AirPods Pro",
            sku: "AIRPODSPRO", 
            quantity: 1,
            unit_price: 4100000,
            line_total: 4100000
          },
          {
            product_id: 6,
            product_name: "Wireless Charger",
            sku: "WIRELESSCHARGER",
            quantity: 1,
            unit_price: 825000,
            line_total: 825000
          }
        ]
      }
    ];

    let created = 0;
    let errors = [];

    for (const order of sampleOrders) {
      try {
        await database.createOrder(order);
        created++;
      } catch (error) {
        console.error(`Error creating sample order:`, error);
        errors.push(error.message);
      }
    }

    res.json({
      success: true,
      message: `Seeding completed. Created: ${created} orders`,
      created,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Seed orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed orders: ' + error.message
    });
  }
});

// Customer Management API Endpoints
app.get('/api/customers', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    const customers = await database.getAllCustomers(
      parseInt(limit),
      parseInt(offset),
      search,
      req.merchant.id
    );
    
    res.json({
      success: true,
      customers,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: customers.length
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers'
    });
  }
});

// Customer stats and export routes (must come before :id route)
app.get('/api/customers/stats', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const stats = await database.getCustomerStats(req.merchant.id);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer statistics'
    });
  }
});

app.get('/api/customers/export/csv', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const csvData = await database.exportCustomersToCSV(req.merchant.id);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('Error exporting customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export customers'
    });
  }
});

app.get('/api/customers/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const customer = await database.getCustomerById(parseInt(req.params.id), req.merchant.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer'
    });
  }
});

app.put('/api/customers/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const result = await database.updateCustomer(parseInt(req.params.id), req.body, req.merchant.id);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update customer'
    });
  }
});

app.delete('/api/customers/:id', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const result = await database.deleteCustomer(parseInt(req.params.id), req.merchant.id);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete customer'
    });
  }
});

// Smart customer matching endpoint
app.post('/api/customers/smart-match', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const customerData = req.body;
    
    if (!customerData.name && !customerData.email && !customerData.phone) {
      return res.status(400).json({
        success: false,
        error: 'At least one of name, email, or phone is required'
      });
    }
    
    const merchantId = req.merchant.id;
    const customer = await database.findOrCreateCustomer(customerData, merchantId);
    
    res.json({
      success: true,
      customer,
      message: customer.created_at === customer.updated_at ? 'New customer created' : 'Existing customer matched and updated'
    });
  } catch (error) {
    console.error('Error in smart customer matching:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to match or create customer'
    });
  }
});

// Statistics API (Combined invoice, order, and customer stats)
app.get('/api/stats', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const invoiceStats = await database.getInvoiceStats(dateFrom, dateTo, req.merchant.id);
    const orderStats = await database.getOrderStats(dateFrom, dateTo, req.merchant.id);
    const customerStats = await database.getCustomerStats(req.merchant.id);
    
    res.json({
      success: true,
      stats: invoiceStats,
      orderStats: orderStats,
      customerStats: customerStats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Payment Processing API Endpoints (Midtrans Integration)
app.post('/api/payments/create', async (req, res) => {
  try {
    const { invoice_id, invoice_number, amount, payment_method, customer_email, customer_name } = req.body;
    
    // Validate required fields
    if (!invoice_id || !invoice_number || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: invoice_id, invoice_number, amount'
      });
    }
    
    // Get invoice details
    const invoice = await database.getInvoice(invoice_id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Invoice has already been paid'
      });
    }
    
    // Create Midtrans payment transaction
    const transactionDetails = {
      order_id: `${invoice_number}-${Date.now()}`,
      gross_amount: Math.round(amount)
    };
    
    const customerDetails = {
      first_name: customer_name || invoice.customer_name,
      email: customer_email || invoice.customer_email,
      phone: invoice.customer_phone
    };
    
    const itemDetails = [];
    try {
      const items = JSON.parse(invoice.items_json);
      items.forEach(item => {
        itemDetails.push({
          id: item.sku || item.productName,
          price: Math.round(item.unitPrice || item.lineTotal),
          quantity: item.quantity || 1,
          name: item.productName
        });
      });
      
      // Add tax if applicable
      if (invoice.tax_amount > 0) {
        itemDetails.push({
          id: 'TAX',
          price: Math.round(invoice.tax_amount),
          quantity: 1,
          name: 'Tax'
        });
      }
      
      // Add shipping if applicable
      if (invoice.shipping_cost > 0) {
        itemDetails.push({
          id: 'SHIPPING',
          price: Math.round(invoice.shipping_cost),
          quantity: 1,
          name: 'Shipping Cost'
        });
      }
    } catch (error) {
      console.error('Error parsing invoice items:', error);
    }
    
    // Mock Midtrans response for demonstration
    // In production, you would use actual Midtrans SDK
    const mockSnapToken = `snap_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update invoice status to sent if it's draft
    if (invoice.status === 'draft') {
      await database.updateInvoiceStatus(invoice_id, 'sent');
    }
    
    // Log payment attempt
    console.log('💳 Payment transaction created:', {
      invoice_number,
      amount,
      payment_method,
      customer_email,
      transaction_id: transactionDetails.order_id
    });
    
    res.json({
      success: true,
      snap_token: mockSnapToken,
      transaction_id: transactionDetails.order_id,
      amount: amount,
      payment_method: payment_method
    });
    
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment: ' + error.message
    });
  }
});

// Mock payment success webhook (In production, this would be called by Midtrans)
app.post('/api/payments/webhook', async (req, res) => {
  try {
    const { order_id, transaction_status, payment_type, fraud_status } = req.body;
    
    // Extract invoice number from order_id
    const invoiceNumber = order_id.split('-')[0];
    
    // Get invoice by number
    const invoice = await database.getInvoiceByNumber(invoiceNumber);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Update invoice status based on transaction status
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      const result = await database.updateInvoiceStatus(invoice.id, 'paid', invoice.merchant_id);

      let message = `✅ Payment confirmed for invoice: ${invoiceNumber}`;
      if (result && result.orderCreated) {
        message += ` and order ${result.orderNumber} was created automatically`;
      } else if (result && result.orderError) {
        message += `, but order creation failed: ${result.orderError}`;
        console.warn('⚠️ Order creation failed during webhook processing:', result.orderError);
      }

      console.log(message);
    }
    
    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook: ' + error.message
    });
  }
});

// Mock payment success endpoint (for demo purposes)
app.post('/api/payments/success', async (req, res) => {
  try {
    const { invoice_id, transaction_id, payment_method } = req.body;
    
    // Get invoice to get merchant_id
    const invoice = await database.getInvoice(invoice_id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    
    // Update invoice status to paid (this automatically creates an order)
    const result = await database.updateInvoiceStatus(invoice_id, 'paid', invoice.merchant_id);

    let message = `✅ Payment successful for invoice ID: ${invoice_id}`;
    if (result && result.orderCreated) {
      message += ` and order ${result.orderNumber} was created automatically`;
    } else if (result && result.orderError) {
      message += `, but order creation failed: ${result.orderError}`;
      console.warn('⚠️ Order creation failed during payment processing:', result.orderError);
    }

    console.log(message);
    
    // Send payment confirmation email
    try {
      if (invoice && invoice.customer_email) {
        const paymentDetails = {
          amount: invoice.grand_total,
          payment_method: payment_method || 'Unknown',
          transaction_id: transaction_id
        };
        
        await emailService.sendPaymentConfirmationEmail(invoice, invoice.customer_email, paymentDetails);
      }
    } catch (emailError) {
      console.error('Failed to send payment confirmation email:', emailError.message);
    }
    
    res.json({
      success: true,
      message: 'Payment processed successfully',
      invoice_id: invoice_id,
      transaction_id: transaction_id,
      orderCreated: result?.orderCreated || false,
      orderId: result?.orderId || null,
      orderNumber: result?.orderNumber || null,
      orderError: result?.orderError || null
    });
    
  } catch (error) {
    console.error('Payment success error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment success: ' + error.message
    });
  }
});

// Payment notification endpoint for email confirmations
app.post('/api/notifications/payment-confirmation', async (req, res) => {
  try {
    const { invoice_id, payment_details, customer_email } = req.body;
    
    // Get invoice details
    const invoice = await database.getInvoice(invoice_id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Send payment confirmation email
    const emailResult = await emailService.sendPaymentConfirmationEmail(
      invoice, 
      customer_email || invoice.customer_email, 
      payment_details
    );
    
    res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Payment confirmation email sent successfully' : 'Failed to send email',
      error: emailResult.error
    });
    
  } catch (error) {
    console.error('Payment notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send payment confirmation: ' + error.message
    });
  }
});

// Send invoice email endpoint
app.post('/api/notifications/send-invoice', async (req, res) => {
  try {
    const { invoice_id, customer_email, include_pdf } = req.body;
    
    // Get invoice details
    const invoice = await database.getInvoice(invoice_id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    console.log('📧 Sending invoice email for:', invoice.invoice_number);
    
    // Send invoice email without PDF attachment
    // Use the merchant data from the invoice itself to ensure consistency
    const currentBusinessSettings = await getCurrentBusinessSettings(req.merchant.id);
    const businessSettings = {
      name: invoice.merchant_name,
      email: invoice.merchant_email,
      address: invoice.merchant_address,
      phone: invoice.merchant_phone,
      website: currentBusinessSettings.website,
      taxId: currentBusinessSettings.taxId,
      logo: currentBusinessSettings.logoUrl || null
    };
    const emailResult = await emailService.sendInvoiceEmail(
      invoice, 
      customer_email || invoice.customer_email,
      null,
      businessSettings
    );
    
    res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Invoice email sent successfully' : 'Failed to send email',
      error: emailResult.error
    });
    
  } catch (error) {
    console.error('Send invoice email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invoice email'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Invoice Generator API is running',
    timestamp: new Date().toISOString()
  });
});

// Logo accessibility test endpoint
app.get('/api/test-logo-url', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL parameter is required'
    });
  }

  try {
    console.log('🧪 Testing logo URL accessibility:', url);
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.json({
        success: false,
        error: 'Invalid URL format',
        url,
        details: error.message
      });
    }

    // Test if URL is accessible
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 5000,
      headers: {
        'User-Agent': 'AI-Invoice-Generator/1.0 (Logo Accessibility Test)'
      }
    });

    const result = {
      success: response.ok,
      url,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      accessible: response.ok,
      isImage: response.headers.get('content-type')?.startsWith('image/') || false
    };

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }

    console.log('🧪 Logo URL test result:', result);
    res.json(result);

  } catch (error) {
    const result = {
      success: false,
      url,
      error: error.message,
      accessible: false,
      timeout: error.name === 'FetchError' && error.message.includes('timeout')
    };
    
    console.error('🧪 Logo URL test failed:', result);
    res.json(result);
  }
});

// Business logo test endpoint
// Debug endpoint to check business settings for current merchant
app.get('/api/debug-business-settings', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    console.log('🔍 Debug business settings for merchant:', req.merchant.id, req.merchant.email);
    
    // Get business settings
    const businessSettings = await database.getBusinessSettings(req.merchant.id);
    console.log('🔍 Raw business settings from database:', businessSettings);
    
    // Get processed settings
    const currentSettings = await getCurrentBusinessSettings(req.merchant.id);
    console.log('🔍 Processed business settings:', currentSettings);
    
    res.json({
      success: true,
      merchant: {
        id: req.merchant.id,
        email: req.merchant.email,
        businessName: req.merchant.businessName
      },
      rawBusinessSettings: businessSettings,
      processedSettings: currentSettings,
      debug: {
        hasLogo: !!currentSettings.logoUrl,
        logoUrl: currentSettings.logoUrl,
        hasTerms: !!currentSettings.termsAndConditions,
        termsAndConditions: currentSettings.termsAndConditions
      }
    });
  } catch (error) {
    console.error('Error getting debug business settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/test-business-logo', async (req, res) => {
  try {
    console.log('🧪 Testing current business logo accessibility...');
    
    // Get current business settings
    const currentBusinessSettings = database.getBusinessSettings();
    const businessProfile = typeof database.getBusinessProfile === 'function' 
      ? database.getBusinessProfile() 
      : null;
    
    const logoPath = businessProfile?.logo || currentBusinessSettings.logoUrl || '/assets/aspree2-logo.png?v=2';
    const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
    
    let logoUrl;
    if (logoPath.startsWith('http') || logoPath.startsWith('data:')) {
      logoUrl = logoPath;
    } else {
      logoUrl = `${baseUrl}/${logoPath.replace(/^\//, '')}`;
    }
    
    console.log('🧪 Constructed logo URL:', logoUrl);
    
    // Test the URL
    const response = await fetch(logoUrl, {
      method: 'HEAD',
      timeout: 5000,
      headers: {
        'User-Agent': 'AI-Invoice-Generator/1.0 (Business Logo Test)'
      }
    });

    const result = {
      success: response.ok,
      businessSettings: {
        name: businessProfile?.name || currentBusinessSettings.name,
        logoPath: logoPath,
        logoUrl: logoUrl
      },
      logoUrl,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      accessible: response.ok,
      isImage: response.headers.get('content-type')?.startsWith('image/') || false
    };

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }

    console.log('🧪 Business logo test result:', result);
    res.json(result);

  } catch (error) {
    const result = {
      success: false,
      error: error.message,
      accessible: false
    };
    
    console.error('🧪 Business logo test failed:', result);
    res.json(result);
  }
});

// Test email sending endpoint for logo testing
app.post('/api/send-test-email', async (req, res) => {
  try {
    const { customerEmail } = req.body;
    
    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Customer email is required'
      });
    }
    
    console.log('🧪 Sending test email with logo debugging...');
    
    // Create a test invoice for logo testing
    const testInvoice = {
      id: 'TEST-001',
      invoice_number: 'INV-TEST-001',
      customer_name: 'Test Customer',
      customer_email: customerEmail,
      customer_phone: '+62123456789',
      customer_address: 'Test Address, Jakarta',
      merchant_name: 'Test Business',
      merchant_address: 'Test Business Address',
      merchant_phone: '+62987654321',
      merchant_email: 'business@test.com',
      items_json: JSON.stringify([
        {
          product_name: 'Test Product',
          quantity: 1,
          unit_price: 100000,
          line_total: 100000
        }
      ]),
      subtotal: 100000,
      discount: 0,
      shipping_cost: 0,
      grand_total: 100000,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      customer_token: 'test-token-12345'
    };
    
    // Get business settings for logo testing
    const currentBusinessSettings = database.getBusinessSettings();
    const businessProfile = typeof database.getBusinessProfile === 'function' 
      ? database.getBusinessProfile() 
      : null;
    
    const businessSettings = {
      name: businessProfile?.name || currentBusinessSettings.name || 'Test Business',
      address: businessProfile?.address || currentBusinessSettings.address || 'Test Address',
      phone: businessProfile?.phone || currentBusinessSettings.phone || '+62123456789',
      email: businessProfile?.email || currentBusinessSettings.email || 'test@business.com',
      website: businessProfile?.website || currentBusinessSettings.website || 'https://test.com',
      logo: businessProfile?.logo || currentBusinessSettings.logoUrl || '/assets/aspree2-logo.png?v=2'
    };
    
    console.log('🧪 Business settings for email test:', businessSettings);
    
    // Send test email
    const emailResult = await emailService.sendInvoiceEmail(testInvoice, customerEmail, null, businessSettings);
    
    res.json({
      success: emailResult.success,
      messageId: emailResult.messageId,
      mode: emailResult.mode,
      error: emailResult.error,
      note: emailResult.note,
      testInvoice: testInvoice.invoice_number,
      businessSettings: {
        name: businessSettings.name,
        logo: businessSettings.logo
      }
    });
    
  } catch (error) {
    console.error('🧪 Test email send failed:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const stats = await database.getInvoiceStats();
    const products = await database.getAllProducts(5, 0);
    const invoices = await database.getAllInvoices(5, 0);
    const orders = await database.getAllOrders(5, 0);
    const orderStats = await database.getOrderStats();
    
    const catalog = products.map(product => ({
      id: `prod_${product.id}`,
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: product.category,
      price: product.unit_price,
      tags: [product.name.toLowerCase(), product.category.toLowerCase(), product.sku.toLowerCase()]
    }));
    
    // Test invoice number generation
    const testInvoiceNumber = await database.generateInvoiceNumber();
    const testOrderNumber = await database.generateOrderNumber();
    
    res.json({
      success: true,
      message: 'Database is working',
      stats,
      orderStats,
      productCount: products.length,
      orderCount: orders.length,
      sampleProducts: products.slice(0, 2),
      sampleOrders: orders.slice(0, 2),
      catalogFormat: catalog.slice(0, 2),
      recentInvoices: invoices.slice(0, 3).map(inv => ({
        id: inv.id,
        number: inv.invoice_number,
        customer: inv.customer_name,
        date: inv.created_at
      })),
      nextInvoiceNumber: testInvoiceNumber,
      nextOrderNumber: testOrderNumber
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: 'Database connection failed: ' + error.message
    });
  }
});


// Seed products endpoint
app.post('/api/seed-products', async (req, res) => {
  try {
    const sampleProducts = [
      {
        sku: "IPHONE15PRO",
        name: "iPhone 15 Pro",
        description: "Latest iPhone with Pro features",
        category: "Smartphones",
        unit_price: 16500000,
        cost_price: 14000000,
        stock_quantity: 25,
        min_stock_level: 5,
        tax_rate: 11,
        weight: 0.187,
        dimensions: "14.7 x 7.1 x 0.8"
      },
      {
        sku: "GALAXYS24",
        name: "Samsung Galaxy S24",
        description: "Premium Android smartphone",
        category: "Smartphones",
        unit_price: 14800000,
        cost_price: 12500000,
        stock_quantity: 30,
        min_stock_level: 8,
        tax_rate: 11,
        weight: 0.168,
        dimensions: "14.7 x 7.1 x 0.8"
      },
      {
        sku: "AIRPODSPRO",
        name: "AirPods Pro",
        description: "Wireless earbuds with noise cancellation",
        category: "Audio",
        unit_price: 4100000,
        cost_price: 3200000,
        stock_quantity: 50,
        min_stock_level: 15,
        tax_rate: 11,
        weight: 0.056,
        dimensions: "4.5 x 6.1 x 2.2"
      },
      {
        sku: "LOLLY001",
        name: "Lolly",
        description: "Sweet lollipop candy",
        category: "Candy",
        unit_price: 5000,
        cost_price: 2000,
        stock_quantity: 100,
        min_stock_level: 20,
        tax_rate: 11,
        weight: 0.01,
        dimensions: "5 x 1 x 1"
      }
    ];

    let created = 0;
    let skipped = 0;

    for (const product of sampleProducts) {
      try {
        const existing = await database.getProductBySku(product.sku);
        if (existing) {
          skipped++;
          continue;
        }
        
        await database.createProduct(product);
        created++;
      } catch (error) {
        console.error(`Error creating product ${product.sku}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Seeding completed. Created: ${created}, Skipped: ${skipped}`,
      created,
      skipped
    });
  } catch (error) {
    console.error('Seed products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed products: ' + error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});



// Performance monitoring endpoint
app.get('/api/performance', async (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      success: true,
      performance: {
        uptime: Math.round(uptime),
        uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        metrics: performanceMetrics,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        cache: {
          size: cache.size,
          hitRate: performanceMetrics.cacheHitRate
        },
        asyncQueue: {
          pending: heavyOperationQueue.length,
          processing: isProcessingQueue
        }
      }
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});



// Real-time metrics endpoint for live dashboard updates
app.get('/api/analytics/realtime', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    
    // Get today's metrics
    const todayInvoices = await database.getAllInvoices(1000, 0, null, null, null, null, req.merchant.id);
    const todayOrders = await database.getAllOrders(1000, 0, null, null, todayStart.toISOString(), null, req.merchant.id);
    
    const todayInvoicesFiltered = todayInvoices.filter(inv => 
      new Date(inv.created_at) >= todayStart
    );
    
    const todayRevenue = todayInvoicesFiltered
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    
    const todayOrdersCount = todayOrders.length;
    const todayInvoicesCount = todayInvoicesFiltered.length;
    
    // Get yesterday's metrics for comparison
    const yesterdayInvoices = todayInvoices.filter(inv => {
      const created = new Date(inv.created_at);
      return created >= yesterdayStart && created < todayStart;
    });
    
    const yesterdayRevenue = yesterdayInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    
    const realtimeMetrics = {
      success: true,
      data: {
        today: {
          revenue: todayRevenue,
          invoices: todayInvoicesCount,
          orders: todayOrdersCount,
          averageOrderValue: todayOrdersCount > 0 ? (todayRevenue / todayOrdersCount) : 0
        },
        yesterday: {
          revenue: yesterdayRevenue,
          invoices: yesterdayInvoices.length
        },
        growth: {
          revenue: yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0,
          invoices: yesterdayInvoices.length > 0 ? ((todayInvoicesCount - yesterdayInvoices.length) / yesterdayInvoices.length * 100) : 0
        },
        performance: {
          systemUptime: process.uptime(),
          memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          cacheHitRate: performanceMetrics.cacheHitRate,
          averageResponseTime: performanceMetrics.averageResponseTime,
          requestsPerMinute: performanceMetrics.requests.total
        },
        timestamp: now.toISOString()
      }
    };
    
    res.json(realtimeMetrics);
    
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch realtime metrics'
    });
  }
});

// Revenue analytics endpoint
app.get('/api/analytics/revenue', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { period = '30d', groupBy = 'day' } = req.query;
    
    const cacheKey = getCacheKey('analytics-revenue', period, groupBy, req.merchant.id);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      const revenueData = await getRevenueAnalytics(period, groupBy, req.merchant.id);
      result = {
        success: true,
        data: revenueData
      };
      
      // Cache for 10 minutes
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analytics'
    });
  }
});

// Customer analytics endpoint
app.get('/api/analytics/customers', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { period = '30d' } = req.query;
    
    const cacheKey = getCacheKey('analytics-customers', period, req.merchant.id);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      const customerAnalytics = await getCustomerAnalytics(period, req.merchant.id);
      result = {
        success: true,
        data: customerAnalytics
      };
      
      // Cache for 15 minutes
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer analytics'
    });
  }
});

// Product analytics endpoint
app.get('/api/analytics/products', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { period = '30d' } = req.query;
    
    const cacheKey = getCacheKey('analytics-products', period, req.merchant.id);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      const productAnalytics = await getProductAnalytics(period, req.merchant.id);
      result = {
        success: true,
        data: productAnalytics
      };
      
      // Cache for 15 minutes
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product analytics'
    });
  }
});

// Analytics helper functions
async function getProductAnalytics(period = '30d', merchantId = null) {
  try {
    const allProducts = await database.getAllProducts(1000, 0, null, false, merchantId);
    const categories = await database.getProductCategories(merchantId);
    const lowStockProducts = await database.getLowStockProducts(merchantId);
    
    // Get all invoices to calculate product sales
    const allInvoices = await database.getAllInvoices(1000, 0, null, null, null, null, merchantId);
    const productSales = {};
    
    allInvoices.forEach(invoice => {
      if (invoice.items_json && Array.isArray(invoice.items_json)) {
        invoice.items_json.forEach(item => {
          const productName = item.productName || item.name;
          if (productName) {
            if (!productSales[productName]) {
              productSales[productName] = {
                quantity: 0,
                revenue: 0,
                invoiceCount: 0
              };
            }
            productSales[productName].quantity += item.quantity || 0;
            productSales[productName].revenue += item.lineTotal || 0;
            productSales[productName].invoiceCount += 1;
          }
        });
      }
    });
    
    // Get top selling products
    const topSellingProducts = Object.entries(productSales)
      .sort(([,a], [,b]) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));
    
    // Get top revenue products
    const topRevenueProducts = Object.entries(productSales)
      .sort(([,a], [,b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));
    
    return {
      totalProducts: allProducts.length,
      activeProducts: allProducts.filter(p => p.is_active).length,
      categories: categories,
      lowStockProducts: lowStockProducts,
      topSellingProducts: topSellingProducts,
      topRevenueProducts: topRevenueProducts,
      totalStockValue: allProducts.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0),
      averageProductPrice: allProducts.length > 0 ? 
        allProducts.reduce((sum, p) => sum + p.unit_price, 0) / allProducts.length : 0
    };
  } catch (error) {
    console.error('Error getting product analytics:', error);
    return {
      totalProducts: 0,
      activeProducts: 0,
      categories: [],
      lowStockProducts: [],
      topSellingProducts: [],
      topRevenueProducts: [],
      totalStockValue: 0,
      averageProductPrice: 0
    };
  }
}

async function getRevenueAnalytics(period = '30d', groupBy = 'day', merchantId = null) {
  try {
    const allInvoices = await database.getAllInvoices(1000, 0, null, null, null, null, merchantId);
    const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');
    
    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    // Filter invoices within period
    const periodInvoices = paidInvoices.filter(inv => {
      const invoiceDate = new Date(inv.paid_at || inv.created_at);
      return invoiceDate >= startDate && invoiceDate <= now;
    });
    
    // Group by time period
    const revenueByPeriod = {};
    periodInvoices.forEach(invoice => {
      const date = new Date(invoice.paid_at || invoice.created_at);
      let key;
      
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!revenueByPeriod[key]) {
        revenueByPeriod[key] = {
          revenue: 0,
          invoices: 0,
          averageOrderValue: 0
        };
      }
      
      revenueByPeriod[key].revenue += invoice.grand_total || 0;
      revenueByPeriod[key].invoices += 1;
    });
    
    // Calculate average order value for each period
    Object.keys(revenueByPeriod).forEach(key => {
      const period = revenueByPeriod[key];
      period.averageOrderValue = period.invoices > 0 ? period.revenue / period.invoices : 0;
    });
    
    // Convert to array and sort by date
    const revenueData = Object.entries(revenueByPeriod)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const totalRevenue = periodInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    const averageOrderValue = periodInvoices.length > 0 ? totalRevenue / periodInvoices.length : 0;
    
    return {
      periodData: revenueData,
      totalRevenue: totalRevenue,
      totalInvoices: periodInvoices.length,
      averageOrderValue: averageOrderValue,
      period: period,
      groupBy: groupBy
    };
  } catch (error) {
    console.error('Error getting revenue analytics:', error);
    return {
      periodData: [],
      totalRevenue: 0,
      totalInvoices: 0,
      averageOrderValue: 0,
      period: period,
      groupBy: groupBy
    };
  }
}

async function getCustomerAnalytics(period = '30d', merchantId = null) {
  try {
    const allCustomers = await database.getAllCustomers(1000, 0, null, merchantId);
    const allInvoices = await database.getAllInvoices(1000, 0, null, null, merchantId);
    
    // Calculate customer lifetime values
    const customerValues = {};
    allInvoices.forEach(invoice => {
      const email = invoice.customer_email;
      if (email) {
        if (!customerValues[email]) {
          customerValues[email] = {
            totalSpent: 0,
            invoiceCount: 0,
            firstPurchase: invoice.created_at,
            lastPurchase: invoice.created_at
          };
        }
        customerValues[email].totalSpent += invoice.grand_total || 0;
        customerValues[email].invoiceCount += 1;
        
        if (new Date(invoice.created_at) < new Date(customerValues[email].firstPurchase)) {
          customerValues[email].firstPurchase = invoice.created_at;
        }
        if (new Date(invoice.created_at) > new Date(customerValues[email].lastPurchase)) {
          customerValues[email].lastPurchase = invoice.created_at;
        }
      }
    });
    
    // Get top customers by value
    const topCustomers = Object.entries(customerValues)
      .sort(([,a], [,b]) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
      .map(([email, data]) => {
        const customer = allCustomers.find(c => c.email === email);
        return {
          email,
          name: customer ? customer.name : 'Unknown',
          ...data
        };
      });
    
    // Calculate customer segments
    const customerSegments = {
      new: 0,
      active: 0,
      inactive: 0,
      vip: 0
    };
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    Object.values(customerValues).forEach(customer => {
      const lastPurchase = new Date(customer.lastPurchase);
      const firstPurchase = new Date(customer.firstPurchase);
      
      if (firstPurchase > thirtyDaysAgo) {
        customerSegments.new++;
      } else if (lastPurchase > thirtyDaysAgo) {
        customerSegments.active++;
      } else {
        customerSegments.inactive++;
      }
      
      if (customer.totalSpent > 10000000) { // 10M IDR
        customerSegments.vip++;
      }
    });
    
    return {
      totalCustomers: allCustomers.length,
      topCustomers: topCustomers,
      customerSegments: customerSegments,
      averageCustomerValue: Object.values(customerValues).length > 0 ? 
        Object.values(customerValues).reduce((sum, c) => sum + c.totalSpent, 0) / Object.values(customerValues).length : 0,
      repeatCustomerRate: Object.values(customerValues).filter(c => c.invoiceCount > 1).length / Object.values(customerValues).length * 100
    };
  } catch (error) {
    console.error('Error getting customer analytics:', error);
    return {
      totalCustomers: 0,
      topCustomers: [],
      customerSegments: { new: 0, active: 0, inactive: 0, vip: 0 },
      averageCustomerValue: 0,
      repeatCustomerRate: 0
    };
  }
}

async function getPerformanceAnalytics() {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    return {
      uptime: uptime,
      uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
      memoryUsage: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      requests: performanceMetrics.requests,
      averageResponseTime: performanceMetrics.averageResponseTime,
      cacheHitRate: performanceMetrics.cacheHitRate,
      cacheSize: cache.size,
      asyncQueueSize: heavyOperationQueue.length
    };
  } catch (error) {
    console.error('Error getting performance analytics:', error);
    return {
      uptime: 0,
      uptimeFormatted: '0h 0m 0s',
      memoryUsage: { used: 0, total: 0, rss: 0 },
      requests: { total: 0, successful: 0, failed: 0, slow: 0 },
      averageResponseTime: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      asyncQueueSize: 0
    };
  }
}

async function getPendingOrdersValue() {
  try {
    const pendingOrders = await database.getAllOrders(1000, 0, 'pending');
    return pendingOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  } catch (error) {
    console.error('Error getting pending orders value:', error);
    return 0;
  }
}

// Optimized search endpoints
app.get('/api/search/invoices', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      q: searchTerm = '', 
      status, 
      dateFrom, 
      dateTo, 
      limit = 50, 
      offset = 0,
      sortBy = 'invoice_date',
      sortOrder = 'desc'
    } = req.query;
    
    // Check cache first
    const cacheKey = getCacheKey('search-invoices', searchTerm, status, dateFrom, dateTo, limit, offset, sortBy, sortOrder);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      // Use optimized database search method
      const searchResult = await database.searchInvoices(
        searchTerm, 
        status && status !== 'all' ? status : null, 
        dateFrom, 
        dateTo, 
        parseInt(limit), 
        parseInt(offset)
      );
      
      result = {
        success: true,
        invoices: searchResult.invoices,
        pagination: {
          total: searchResult.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          page: searchResult.page,
          totalPages: searchResult.totalPages,
          hasMore: parseInt(offset) + parseInt(limit) < searchResult.total
        }
      };
      
      // Cache for 2 minutes
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`🔍 Invoice search completed in ${processingTime}ms`);
    
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error searching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search invoices'
    });
  }
});

app.get('/api/search/customers', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      q: searchTerm = '', 
      limit = 50, 
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;
    
    // Check cache first
    const cacheKey = getCacheKey('search-customers', searchTerm, limit, offset, sortBy, sortOrder);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      // Use optimized database search method
      const searchResult = await database.searchCustomers(
        searchTerm, 
        req.merchant.id, 
        parseInt(limit), 
        parseInt(offset)
      );
      
      result = {
        success: true,
        customers: searchResult.customers,
        pagination: {
          total: searchResult.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          page: searchResult.page,
          totalPages: searchResult.totalPages,
          hasMore: parseInt(offset) + parseInt(limit) < searchResult.total
        }
      };
      
      // Cache for 2 minutes
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`🔍 Customer search completed in ${processingTime}ms`);
    
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search customers'
    });
  }
});

app.get('/api/search/products', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      q: searchTerm = '', 
      category, 
      active_only = 'true',
      limit = 50, 
      offset = 0,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;
    
    // Check cache first
    const cacheKey = getCacheKey('search-products', searchTerm, category, active_only, limit, offset, sortBy, sortOrder);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      // Use optimized database search method
      const searchResult = await database.searchProducts(
        searchTerm, 
        category, 
        null, // priceMin
        null, // priceMax
        active_only === 'true',
        parseInt(limit), 
        parseInt(offset),
        req.merchant.id
      );
      
      result = {
        success: true,
        products: searchResult.products,
        pagination: {
          total: searchResult.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          page: searchResult.page,
          totalPages: searchResult.totalPages,
          hasMore: parseInt(offset) + parseInt(limit) < searchResult.total
        }
      };
      
      // Cache for 2 minutes
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`🔍 Product search completed in ${processingTime}ms`);
    
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products'
    });
  }
});

app.get('/api/search/orders', async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      q: searchTerm = '', 
      status, 
      dateFrom, 
      dateTo, 
      limit = 50, 
      offset = 0,
      sortBy = 'order_date',
      sortOrder = 'desc'
    } = req.query;
    
    // Check cache first
    const cacheKey = getCacheKey('search-orders', searchTerm, status, dateFrom, dateTo, limit, offset, sortBy, sortOrder);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      // Use optimized database search method
      const searchResult = await database.searchOrders(
        searchTerm, 
        status, 
        null, // customerEmail
        dateFrom, 
        dateTo, 
        parseInt(limit), 
        parseInt(offset)
      );
      
      result = {
        success: true,
        orders: searchResult.orders,
        pagination: {
          total: searchResult.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          page: searchResult.page,
          totalPages: searchResult.totalPages,
          hasMore: parseInt(offset) + parseInt(limit) < searchResult.total
        }
      };
      
      // Cache for 2 minutes
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`🔍 Order search completed in ${processingTime}ms`);
    
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error searching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search orders'
    });
  }
});

// Advanced search endpoint with faceted search
app.get('/api/search/advanced', authMiddleware.authenticateMerchant, async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      q: searchTerm = '', 
      type = 'all', // 'invoices', 'customers', 'products', 'orders', 'all'
      limit = 10
    } = req.query;
    
    // Check cache first with merchant ID
    const cacheKey = getCacheKey('search-advanced', searchTerm, type, limit, req.merchant.id);
    let result = getFromCache(cacheKey);
    
    if (!result) {
      const results = {
        invoices: [],
        customers: [],
        products: [],
        orders: []
      };
      
      const term = searchTerm.toLowerCase();
      
      if (type === 'all' || type === 'invoices') {
        const invoices = await database.getAllInvoices(1000, 0, null, null, null, null, req.merchant.id);
        results.invoices = invoices
          .filter(invoice => 
            invoice.invoice_number?.toLowerCase().includes(term) ||
            invoice.customer_name?.toLowerCase().includes(term) ||
            invoice.customer_email?.toLowerCase().includes(term)
          )
          .slice(0, parseInt(limit));
      }
      
      if (type === 'all' || type === 'customers') {
        const customers = await database.getAllCustomers(1000, 0, null, req.merchant.id);
        results.customers = customers
          .filter(customer => 
            customer.name?.toLowerCase().includes(term) ||
            customer.email?.toLowerCase().includes(term) ||
            customer.phone?.toLowerCase().includes(term)
          )
          .slice(0, parseInt(limit));
      }
      
      if (type === 'all' || type === 'products') {
        const products = await database.getAllProducts(1000, 0, null, true, req.merchant.id);
        results.products = products
          .filter(product => 
            product.name?.toLowerCase().includes(term) ||
            product.description?.toLowerCase().includes(term) ||
            product.sku?.toLowerCase().includes(term)
          )
          .slice(0, parseInt(limit));
      }
      
      if (type === 'all' || type === 'orders') {
        const orders = await database.getAllOrders(1000, 0, null, null, null, null, req.merchant.id);
        results.orders = orders
          .filter(order => 
            order.order_number?.toLowerCase().includes(term) ||
            order.customer_name?.toLowerCase().includes(term) ||
            order.customer_email?.toLowerCase().includes(term)
          )
          .slice(0, parseInt(limit));
      }
      
      result = {
        success: true,
        results,
        totalFound: {
          invoices: results.invoices.length,
          customers: results.customers.length,
          products: results.products.length,
          orders: results.orders.length
        }
      };
      
      // Cache for 1 minute (shorter for advanced search)
      setCache(cacheKey, result);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`🔍 Advanced search completed in ${processingTime}ms`);
    
    res.json({
      ...result,
      processingTime
    });
    
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform advanced search'
    });
  }
});

// Analytics API endpoints
// REMOVED: Duplicate revenue analytics endpoint - use the one above with proper merchant isolation

app.get('/api/analytics/sales', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const invoices = await database.getAllInvoices(1000, 0, null, null, null, null, req.merchant.id);
    const orders = await database.getAllOrders(1000, 0, null, null, null, null, req.merchant.id);
    
    const totalOrders = orders.length;
    const completedOrders = orders.filter(order => order.status === 'delivered').length;
    const pendingOrders = orders.filter(order => ['pending', 'processing', 'shipped'].includes(order.status)).length;
    
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
    const conversionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices * 100).toFixed(1) : 0;
    
    res.json({
      success: true,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalInvoices,
      paidInvoices,
      conversionRate: parseFloat(conversionRate)
    });
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales analytics'
    });
  }
});

// REMOVED: Duplicate customer analytics endpoint - use the one above with proper merchant isolation

app.get('/api/analytics/top-products', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const invoices = await database.getAllInvoices(1000, 0, null, null, null, null, req.merchant.id);
    const products = await database.getAllProducts(1000, 0, null, true, req.merchant.id);
    
    // Aggregate product sales data
    const productSales = {};
    
    invoices.forEach(invoice => {
      if (invoice.items_json) {
        let items = [];
        try {
          items = typeof invoice.items_json === 'string' 
            ? JSON.parse(invoice.items_json) 
            : invoice.items_json;
        } catch (e) {
          console.error('Error parsing invoice items:', e);
          return;
        }
        
        items.forEach(item => {
          const sku = item.sku || item.productSku;
          if (!productSales[sku]) {
            productSales[sku] = {
              name: item.productName || item.product_name,
              sku: sku,
              totalSold: 0,
              revenue: 0
            };
          }
          productSales[sku].totalSold += item.quantity || 0;
          productSales[sku].revenue += (item.lineTotal || item.line_total || 0);
        });
      }
    });
    
    // Sort by total sold and get top 10
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 10);
    
    res.json({
      success: true,
      products: topProducts
    });
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top products'
    });
  }
});

app.get('/api/analytics/recent-activity', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const invoices = await database.getAllInvoices(50, 0, null, null, null, null, req.merchant.id);
    const orders = await database.getAllOrders(50, 0, null, null, null, null, req.merchant.id);
    const customers = await database.getAllCustomers(50, 0, null, req.merchant.id);
    
    const activities = [];
    
    // Add recent invoices
    invoices.slice(-5).forEach(invoice => {
      activities.push({
        type: 'invoice',
        description: `Invoice ${invoice.invoice_number} created for ${invoice.customer_name}`,
        timestamp: invoice.created_at,
        amount: invoice.grand_total
      });
    });
    
    // Add recent orders
    orders.slice(-5).forEach(order => {
      activities.push({
        type: 'order',
        description: `Order ${order.order_number} ${order.status}`,
        timestamp: order.updated_at,
        amount: order.total_amount
      });
    });
    
    // Add recent customers
    customers.slice(-3).forEach(customer => {
      activities.push({
        type: 'customer',
        description: `New customer ${customer.name} registered`,
        timestamp: customer.created_at
      });
    });
    
    // Sort by timestamp and get latest 10
    const recentActivities = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
    
    res.json({
      success: true,
      activities: recentActivities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity'
    });
  }
});

app.get('/api/analytics/ai-insights', async (req, res) => {
  try {
    const invoices = await database.getAllInvoices();
    const orders = await database.getAllOrders();
    const products = await database.getAllProducts();
    const customers = await database.getAllCustomers();
    
    const insights = [];
    
    // Revenue trend insight
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    if (totalRevenue > 0) {
      insights.push({
        icon: '📈',
        title: 'Revenue Growth',
        description: `You've generated ${paidInvoices.length} paid invoices with total revenue of ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalRevenue).replace('IDR', 'Rp')}`,
        action: 'showSection("analytics")',
        actionText: 'View Details'
      });
    }
    
    // Low stock insight
    const lowStockProducts = products.filter(product => 
      product.stock_quantity <= product.min_stock_level && product.is_active
    );
    if (lowStockProducts.length > 0) {
      insights.push({
        icon: '⚠️',
        title: 'Low Stock Alert',
        description: `${lowStockProducts.length} products are running low on stock. Consider restocking soon.`,
        action: 'showSection("products")',
        actionText: 'Manage Stock'
      });
    }
    
    // Customer engagement insight
    if (customers.length > 0) {
      const activeCustomers = customers.filter(c => c.total_orders > 0).length;
      const engagementRate = (activeCustomers / customers.length * 100).toFixed(1);
      insights.push({
        icon: '👥',
        title: 'Customer Engagement',
        description: `${engagementRate}% of your customers (${activeCustomers}/${customers.length}) have made purchases.`,
        action: 'showSection("customers")',
        actionText: 'View Customers'
      });
    }
    
    // AI learning insight
    insights.push({
      icon: '🤖',
      title: 'AI Auto-Learning Active',
      description: 'Your AI system is continuously learning from invoice patterns to improve accuracy and efficiency.',
      action: null,
      actionText: null
    });
    
    res.json({
      success: true,
      insights: insights
    });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI insights'
    });
  }
});

// PREMIUM LOGO UPLOAD API ENDPOINTS
// Premium Logo Upload Endpoint
app.post('/api/upload-premium-logo', authMiddleware.authenticateMerchant, upload.single('logo'), async (req, res) => {
  try {
    console.log('📸 Premium logo upload request received');
    console.log('File details:', req.file);
    console.log('Logo type:', req.body.type); // 'header' or 'footer'
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    const logoType = req.body.type; // 'header' or 'footer'
    if (!logoType || !['header', 'footer'].includes(logoType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid logo type. Must be "header" or "footer"' 
      });
    }

    const merchantId = req.merchant.id;
    console.log(`📤 Uploading ${logoType} logo for merchant:`, merchantId);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: `ai-invoice-generator/premium-logos/${logoType}/merchant_${merchantId}`,
        public_id: `merchant_${merchantId}_${logoType}_logo_${Date.now()}`,
        transformation: [
          { width: logoType === 'header' ? 400 : 200, height: logoType === 'header' ? 200 : 100, crop: 'limit' },
          { quality: 'auto:good' },
          { format: 'auto' }
        ]
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error(`❌ Cloudinary upload error for ${logoType} logo:`, error);
            reject(error);
          } else {
            console.log(`✅ ${logoType} logo uploaded successfully:`, result.secure_url);
            resolve(result);
          }
        }
      );

      uploadStream.end(req.file.buffer);
    });

    // Update business settings with new logo URL
    const updateData = {};
    if (logoType === 'header') {
      updateData.customHeaderLogoUrl = result.secure_url;
      updateData.customHeaderLogoPublicId = result.public_id;
    } else {
      updateData.customFooterLogoUrl = result.secure_url;
      updateData.customFooterLogoPublicId = result.public_id;
    }

    await database.updateBusinessSettings(updateData, merchantId);

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      message: `${logoType} logo uploaded successfully`
    });

  } catch (error) {
    console.error(`❌ Error uploading premium ${req.body.type} logo:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to upload logo' 
    });
  }
});

// Remove Premium Logo Endpoint
app.delete('/api/remove-premium-logo/:type', authMiddleware.authenticateMerchant, async (req, res) => {
  try {
    const logoType = req.params.type; // 'header' or 'footer'
    const merchantId = req.merchant.id;

    if (!['header', 'footer'].includes(logoType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid logo type' 
      });
    }

    console.log(`🗑️ Removing ${logoType} logo for merchant:`, merchantId);

    // Get current logo info
    const settings = await database.getBusinessSettings(merchantId);
    const publicId = logoType === 'header' ? 
      settings.customHeaderLogoPublicId || settings.custom_header_logo_public_id :
      settings.customFooterLogoPublicId || settings.custom_footer_logo_public_id;

    // Remove from Cloudinary if exists
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`✅ ${logoType} logo removed from Cloudinary:`, publicId);
      } catch (cloudinaryError) {
        console.error(`⚠️ Error removing ${logoType} logo from Cloudinary:`, cloudinaryError);
      }
    }

    // Update database
    const updateData = {};
    if (logoType === 'header') {
      updateData.customHeaderLogoUrl = null;
      updateData.customHeaderLogoPublicId = null;
    } else {
      updateData.customFooterLogoUrl = null;
      updateData.customFooterLogoPublicId = null;
    }

    await database.updateBusinessSettings(updateData, merchantId);

    res.json({
      success: true,
      message: `${logoType} logo removed successfully`
    });

  } catch (error) {
    console.error(`❌ Error removing premium ${req.params.type} logo:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to remove logo' 
    });
  }
});

// Unified Premium Branding Save Endpoint
app.post('/api/save-premium-branding', authMiddleware.authenticateMerchant, logoUpload.fields([
  { name: 'headerLogo', maxCount: 1 },
  { name: 'footerLogo', maxCount: 1 }
]), async (req, res) => {
  try {
    const merchantId = req.merchant.id;
    console.log('💎 Saving premium branding for merchant:', merchantId);
    console.log('📋 Form data received:', {
      customHeaderText: req.body.customHeaderText,
      hasHeaderLogo: !!(req.files && req.files.headerLogo),
      hasFooterLogo: !!(req.files && req.files.footerLogo),
      hideAspreeBranding: req.body.hideAspreeBranding
    });
    
    // Prepare settings data
    const settingsData = {
      customHeaderText: req.body.customHeaderText || '',
      customHeaderBgColor: req.body.customHeaderBgColor || '#311d6b',
      customFooterBgColor: req.body.customFooterBgColor || '#311d6b',
      customHeaderTextColor: req.body.customHeaderTextColor || '#ffffff',
      customFooterTextColor: req.body.customFooterTextColor || '#ffffff',
      hideAspreeBranding: req.body.hideAspreeBranding === 'true'
    };
    
    // Upload logos if provided
    if (req.files && req.files.headerLogo) {
      console.log('📤 Uploading header logo...');
      const headerResult = await cloudinaryService.uploadImage(req.files.headerLogo[0].buffer, {
        filename: `merchant_${merchantId}_header_logo_${Date.now()}`,
        merchantId: merchantId,
        folder: `ai-invoice-generator/premium-logos/header/merchant_${merchantId}`,
        transformation: [
          { width: 400, height: 200, crop: 'limit' },
          { quality: 'auto:good' },
          { format: 'auto' }
        ]
      });
      settingsData.customHeaderLogoUrl = headerResult.secure_url;
      settingsData.customHeaderLogoPublicId = headerResult.public_id;
    }

    if (req.files && req.files.footerLogo) {
      console.log('📤 Uploading footer logo...');
      const footerResult = await cloudinaryService.uploadImage(req.files.footerLogo[0].buffer, {
        filename: `merchant_${merchantId}_footer_logo_${Date.now()}`,
        merchantId: merchantId,
        folder: `ai-invoice-generator/premium-logos/footer/merchant_${merchantId}`,
        transformation: [
          { width: 200, height: 100, crop: 'limit' },
          { quality: 'auto:good' },
          { format: 'auto' }
        ]
      });
      settingsData.customFooterLogoUrl = footerResult.secure_url;
      settingsData.customFooterLogoPublicId = footerResult.public_id;
    }
    
    // Save everything at once
    await database.updateBusinessSettings(settingsData, merchantId);
    
    console.log('✅ Premium branding saved successfully for merchant:', merchantId);
    res.json({
      success: true,
      message: 'Premium branding saved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error saving premium branding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save premium branding'
    });
  }
});

// Note: uploadToCloudinary function removed - now using cloudinaryService.uploadImage directly

// Start the server
async function startServer() {
  // Print configuration summary
  config.printStartupInfo();
  
  // Initialize email service
  await emailService.initialize();
  
  let server;
  
  if (config.ssl.enabled) {
    console.log('🔐 Starting HTTPS server...');
    
    // Setup SSL certificates
    const sslReady = await sslManager.setupSSL();
    if (!sslReady) {
      console.error('❌ SSL setup failed. Exiting...');
      process.exit(1);
    }
    
    // Print SSL status
    sslManager.printSSLStatus();
    
    // Load SSL certificates
    try {
      const { cert, key } = sslManager.loadCertificates();
      const httpsOptions = { cert, key };
      
      // Create HTTPS server
      server = https.createServer(httpsOptions, app);
      
      server.listen(PORT, config.server.host, () => {
        console.log(`🔒 HTTPS Server running at: https://${config.server.host}:${PORT}`);
        printServerInfo();
      });
      
      // Also start HTTP server for redirect (in production)
      if (config.isProduction) {
        const httpApp = express();
        httpApp.use((req, res) => {
          res.redirect(301, `https://${req.headers.host}${req.url}`);
        });
        
        httpApp.listen(80, config.server.host, () => {
          console.log('🔄 HTTP redirect server running on port 80');
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to start HTTPS server:', error.message);
      process.exit(1);
    }
  } else {
    console.log('🌐 Starting HTTP server...');
    server = http.createServer(app);
    
    server.listen(PORT, config.server.host, () => {
      console.log(`🌐 HTTP Server running at: http://${config.server.host}:${PORT}`);
      printServerInfo();
    });
  }
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📴 Shutting down server...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('📴 Shutting down server...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

function printServerInfo() {
  console.log('📱 Open your browser and go to the URL above');
  console.log('💡 Make sure you have set OPENAI_API_KEY environment variable');
  
  // Print additional development info
  if (config.isDevelopment) {
    console.log('\n📋 Development Mode Features:');
    console.log('• Mock payments enabled');
    console.log('• Debug logging enabled');
    console.log('• CORS enabled for development');
    console.log('• Check .env.example for configuration options');
    
    if (config.ssl.enabled) {
      console.log('• Self-signed SSL certificate (accept security warning)');
    }
  }
  
  console.log('='.repeat(50));
}

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
