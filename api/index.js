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

// Check if OpenAI API key is available
const hasOpenAI = !!process.env.OPENAI_API_KEY;

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
      aiAutoLearning: !!aiAutoLearning,
      emailService: true,
      whatsappIntegration: config.features.whatsappIntegration,
      paymentGateway: config.features.paymentGateway
    }
  });
});

// Main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Invoice Generator</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .feature { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        .status { color: green; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚀 AI Invoice Generator</h1>
        <p>Powered by OpenAI - Generate professional invoices with AI assistance</p>
      </div>
      
      <div class="feature">
        <h3>✨ Features</h3>
        <ul>
          <li>AI-powered invoice generation</li>
          <li>Multiple export formats (PDF, WhatsApp, Email)</li>
          <li>Payment gateway integration</li>
          <li>Auto-learning customer and product data</li>
          <li>Multi-language support</li>
        </ul>
      </div>
      
      <div class="feature">
        <h3>🔗 Quick Links</h3>
        <p><a href="/api/health" class="btn">Health Check</a></p>
        <p><a href="/auth/login" class="btn">Login</a></p>
      </div>
      
      <div class="feature">
        <h3>📊 System Status</h3>
        <p>AI Service: <span class="status">${hasOpenAI ? 'Active' : 'Disabled - Missing API Key'}</span></p>
        <p>Environment: <span class="status">${config.isProduction ? 'Production' : 'Development'}</span></p>
        <p>Server: <span class="status">Vercel Serverless</span></p>
      </div>
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