import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.env === 'development';
    this.isProduction = this.env === 'production';
    this.isStaging = this.env === 'staging';
    
    // Validate required environment variables
    this.validateConfig();
  }

  validateConfig() {
    const requiredVars = ['OPENAI_API_KEY'];
    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.error('📋 Please check your .env file or environment configuration');
      if (this.isProduction) {
        process.exit(1);
      }
    }
  }

  // Server Configuration
  get server() {
    const port = parseInt(process.env.PORT) || 3000;
    const host = process.env.HOST || (this.isProduction ? '0.0.0.0' : 'localhost');
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
    
    return {
      port,
      host,
      baseUrl,
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 50,
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
    };
  }

  // AI Configuration
  get ai() {
    return {
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    };
  }

  // Email Configuration
  get email() {
    return {
      enabled: process.env.FEATURE_EMAIL_NOTIFICATIONS === 'true',
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  // Payment Gateway Configuration
  get payment() {
    return {
      enabled: process.env.FEATURE_PAYMENT_GATEWAY === 'true',
      midtrans: {
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
        environment: process.env.MIDTRANS_ENVIRONMENT || 'sandbox',
        isProduction: process.env.MIDTRANS_ENVIRONMENT === 'production',
      },
      mockPayments: process.env.MOCK_PAYMENTS === 'true' || this.isDevelopment,
    };
  }

  // Database Configuration
  get database() {
    return {
      type: process.env.DB_TYPE || 'json',
      jsonPath: process.env.DB_JSON_PATH || './database.json',
      backup: {
        enabled: process.env.DB_BACKUP_ENABLED === 'true',
        interval: parseInt(process.env.DB_BACKUP_INTERVAL) || 3600000, // 1 hour
        retention: parseInt(process.env.DB_BACKUP_RETENTION) || 7, // 7 days
      },
    };
  }

  // Security Configuration
  get security() {
    return {
      jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      sessionSecret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
      corsOrigin: process.env.CORS_ORIGIN || '*',
      enableCors: process.env.ENABLE_CORS === 'true' || this.isDevelopment,
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      },
    };
  }

  // SSL Configuration
  get ssl() {
    return {
      enabled: process.env.SSL_ENABLED === 'true',
      certPath: process.env.SSL_CERT_PATH || './ssl/cert.pem',
      keyPath: process.env.SSL_KEY_PATH || './ssl/key.pem',
    };
  }

  // Merchant Configuration
  get merchant() {
    return {
      businessName: process.env.MERCHANT_NAME || 'Toko Gadget Teknologi',
      address: process.env.MERCHANT_ADDRESS || 'Jl. Teknologi No. 123, Jakarta Selatan, DKI Jakarta 12345',
      phone: process.env.MERCHANT_PHONE || '+62 21 1234 5678',
      email: process.env.MERCHANT_EMAIL || 'billing@tokogadget.co.id',
      website: process.env.MERCHANT_WEBSITE || 'https://tokogadget.co.id',
      taxId: process.env.MERCHANT_TAX_ID || '01.123.456.7-123.000',
      taxRate: parseFloat(process.env.MERCHANT_TAX_RATE) || 0,
    };
  }

  // Feature Flags
  get features() {
    return {
      emailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS === 'true',
      paymentGateway: process.env.FEATURE_PAYMENT_GATEWAY === 'true',
      whatsappIntegration: process.env.FEATURE_WHATSAPP_INTEGRATION === 'true',
      pdfGeneration: process.env.FEATURE_PDF_GENERATION === 'true',
      analytics: process.env.FEATURE_ANALYTICS === 'true',
      multiCurrency: process.env.FEATURE_MULTI_CURRENCY === 'true',
    };
  }

  // Logging Configuration
  get logging() {
    return {
      level: process.env.LOG_LEVEL || (this.isProduction ? 'warn' : 'info'),
      file: process.env.LOG_FILE || './logs/app.log',
      maxSize: process.env.LOG_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      console: this.isDevelopment,
    };
  }

  // Performance Configuration
  get performance() {
    return {
      cache: {
        enabled: process.env.CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.CACHE_TTL) || 3600,
      },
      pdf: {
        timeout: parseInt(process.env.PDF_GENERATION_TIMEOUT) || 10000,
      },
    };
  }

  // Development Configuration
  get development() {
    return {
      debugMode: process.env.DEBUG_MODE === 'true' || this.isDevelopment,
      mockPayments: process.env.MOCK_PAYMENTS === 'true' || this.isDevelopment,
      enableCors: process.env.ENABLE_CORS === 'true' || this.isDevelopment,
    };
  }

  // Helper Methods
  isFeatureEnabled(feature) {
    return this.features[feature] === true;
  }

  getCustomerPortalUrl(token) {
    return `${this.server.baseUrl}/customer?token=${token}`;
  }

  getMerchantDashboardUrl() {
    return `${this.server.baseUrl}/merchant`;
  }

  // Configuration Summary
  getConfigSummary() {
    return {
      environment: this.env,
      server: {
        port: this.server.port,
        host: this.server.host,
        baseUrl: this.server.baseUrl,
      },
      features: this.features,
      email: {
        enabled: this.email.enabled,
        configured: !!(this.email.user && this.email.pass),
      },
      payment: {
        enabled: this.payment.enabled,
        configured: !!(this.payment.midtrans.serverKey && this.payment.midtrans.clientKey),
        environment: this.payment.midtrans.environment,
      },
      ssl: this.ssl,
      database: {
        type: this.database.type,
        backupEnabled: this.database.backup.enabled,
      },
    };
  }

  // Print Configuration on Startup
  printStartupInfo() {
    console.log('🚀 AI Invoice Generator Configuration');
    console.log('='.repeat(50));
    console.log(`🌐 Environment: ${this.env.toUpperCase()}`);
    console.log(`🔗 Server: ${this.server.baseUrl}`);
    console.log(`📧 Email: ${this.email.enabled ? (this.email.user ? '✅ Configured' : '⚠️  Not configured') : '❌ Disabled'}`);
    console.log(`💳 Payments: ${this.payment.enabled ? (this.payment.midtrans.serverKey ? `✅ ${this.payment.midtrans.environment}` : '⚠️  Not configured') : '❌ Disabled'}`);
    console.log(`🔒 SSL: ${this.ssl.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`📊 Features: ${Object.entries(this.features).filter(([,enabled]) => enabled).map(([name]) => name).join(', ')}`);
    console.log('='.repeat(50));
  }

  // Environment-specific configurations
  getEnvironmentConfig() {
    const baseConfig = this.getConfigSummary();
    
    switch (this.env) {
      case 'production':
        return {
          ...baseConfig,
          security: {
            ...this.security,
            strictMode: true,
          },
          logging: {
            ...this.logging,
            level: 'warn',
          },
        };
      
      case 'staging':
        return {
          ...baseConfig,
          security: {
            ...this.security,
            strictMode: true,
          },
          logging: {
            ...this.logging,
            level: 'info',
          },
        };
      
      default: // development
        return {
          ...baseConfig,
          development: this.development,
        };
    }
  }
}

export default new ConfigManager();