import dotenv from 'dotenv';

// Load environment variables once at application startup
dotenv.config();

/**
 * Centralized application configuration
 * Loads environment variables once and provides typed access
 */
class AppConfig {
  constructor() {
    if (AppConfig.instance) {
      return AppConfig.instance;
    }

    // OpenAI Configuration
    this.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      maxTokens: {
        invoice: 1500,        // Reduced for optimized prompts
        validation: 800,      // Reduced for focused validation
        extraction: 1500,     // Increased to ensure paymentSchedule isn't truncated
        matching: 1200,       // Reduced for efficient matching
        customization: 1500
      },
      temperature: 0.1,       // Lower for more consistent results
      topP: 0.9,              // Add for better consistency
      frequencyPenalty: 0.1   // Reduce repetitive responses
    };

    // Server Configuration
    this.server = {
      port: process.env.PORT || 3000,
      host: process.env.HOST || 'localhost',
      environment: process.env.NODE_ENV || 'development'
    };

    // Email Configuration
    this.email = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      secure: process.env.EMAIL_SECURE === 'true'
    };

    // Database Configuration
    this.database = {
      path: process.env.DB_PATH || './invoices.db',
      backupInterval: parseInt(process.env.DB_BACKUP_INTERVAL) || 3600000 // 1 hour
    };

    // Payment Configuration
    this.payment = {
      sandbox: process.env.NODE_ENV !== 'production',
      webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET
    };

    // AI Processing Configuration
    this.processing = {
      batchDelay: parseInt(process.env.BATCH_DELAY) || 1000,
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      timeoutMs: parseInt(process.env.PROCESSING_TIMEOUT) || 30000
    };

    // Feature Flags
    this.features = {
      emailNotifications: process.env.ENABLE_EMAIL !== 'false',
      paymentGateway: process.env.ENABLE_PAYMENTS !== 'false',
      whatsappIntegration: process.env.ENABLE_WHATSAPP !== 'false',
      pdfGeneration: process.env.ENABLE_PDF !== 'false',
      analytics: process.env.ENABLE_ANALYTICS !== 'false',
      autoLearning: process.env.ENABLE_AUTO_LEARNING !== 'false'
    };

    // Validation
    this.validate();

    // Store singleton instance
    AppConfig.instance = this;
    
    console.log('✅ Application configuration loaded');
  }

  /**
   * Validate required configuration
   */
  validate() {
    const required = [
      { key: 'OPENAI_API_KEY', value: this.openai.apiKey, name: 'OpenAI API Key' }
    ];

    const missing = required.filter(config => !config.value);
    
    if (missing.length > 0) {
      const missingKeys = missing.map(config => config.name).join(', ');
      throw new Error(`Missing required configuration: ${missingKeys}`);
    }
  }

  /**
   * Get configuration summary for debugging
   */
  getSummary() {
    return {
      openai: {
        model: this.openai.model,
        hasApiKey: !!this.openai.apiKey
      },
      server: this.server,
      email: {
        host: this.email.host,
        port: this.email.port,
        hasCredentials: !!(this.email.user && this.email.password)
      },
      features: this.features,
      environment: this.server.environment
    };
  }

  /**
   * Check if running in development mode
   */
  isDevelopment() {
    return this.server.environment === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction() {
    return this.server.environment === 'production';
  }

  /**
   * Get feature flag status
   */
  isFeatureEnabled(featureName) {
    return this.features[featureName] === true;
  }
}

// Export singleton instance
export default AppConfig;