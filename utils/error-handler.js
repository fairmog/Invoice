// Centralized error handling utility
// Provides consistent error handling across all components

class ErrorHandler {
  constructor() {
    this.errorTypes = {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      CALCULATION_ERROR: 'CALCULATION_ERROR',
      AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
      DATABASE_ERROR: 'DATABASE_ERROR',
      NETWORK_ERROR: 'NETWORK_ERROR',
      AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
      RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    };
  }

  // Create standardized error object
  createError(type, message, details = {}, originalError = null) {
    const error = new Error(message);
    error.type = type;
    error.details = details;
    error.timestamp = new Date().toISOString();
    error.originalError = originalError;
    error.stack = originalError?.stack || error.stack;
    
    return error;
  }

  // Handle AI service errors with retry logic
  handleAIServiceError(error, context = {}) {
    let errorType = this.errorTypes.AI_SERVICE_ERROR;
    let userMessage = 'AI service temporarily unavailable. Please try again.';
    let shouldRetry = false;
    let retryDelay = 1000;

    if (error.message?.includes('rate limit') || error.status === 429) {
      errorType = this.errorTypes.RATE_LIMIT_ERROR;
      userMessage = 'Too many requests. Please wait a moment and try again.';
      shouldRetry = true;
      retryDelay = 30000; // 30 seconds for rate limits
    } else if (error.message?.includes('timeout') || error.code === 'ECONNRESET') {
      errorType = this.errorTypes.NETWORK_ERROR;
      userMessage = 'Connection timeout. Please check your internet and try again.';
      shouldRetry = true;
      retryDelay = 5000;
    } else if (error.message?.includes('invalid API key') || error.status === 401) {
      errorType = this.errorTypes.AUTHENTICATION_ERROR;
      userMessage = 'API configuration error. Please contact support.';
      shouldRetry = false;
    } else if (error.message?.includes('insufficient credits') || error.status === 402) {
      errorType = this.errorTypes.AI_SERVICE_ERROR;
      userMessage = 'AI service credits exhausted. Please contact support.';
      shouldRetry = false;
    } else if (error.status >= 500) {
      userMessage = 'AI service is experiencing issues. Please try again later.';
      shouldRetry = true;
      retryDelay = 10000;
    }

    return {
      error: this.createError(errorType, userMessage, {
        ...context,
        originalStatus: error.status,
        originalMessage: error.message,
        shouldRetry,
        retryDelay
      }, error),
      shouldRetry,
      retryDelay
    };
  }

  // Handle validation errors
  handleValidationError(validationResult, context = {}) {
    const errors = validationResult.errors || [];
    const warnings = validationResult.warnings || [];
    
    const errorMessages = errors.map(err => err.message || err);
    const warningMessages = warnings.map(warn => warn.message || warn);
    
    return this.createError(
      this.errorTypes.VALIDATION_ERROR,
      `Validation failed: ${errorMessages.join(', ')}`,
      {
        ...context,
        errors: errorMessages,
        warnings: warningMessages,
        fieldErrors: errors.filter(err => err.field)
      }
    );
  }

  // Handle database errors
  handleDatabaseError(error, operation = 'database operation', context = {}) {
    let errorType = this.errorTypes.DATABASE_ERROR;
    let userMessage = 'Database error occurred. Please try again.';

    if (error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('UNIQUE constraint')) {
      userMessage = 'Record already exists with this information.';
    } else if (error.code === 'SQLITE_READONLY' || error.message?.includes('readonly')) {
      userMessage = 'Database is temporarily read-only. Please try again later.';
    } else if (error.code === 'ENOENT' || error.message?.includes('no such file')) {
      userMessage = 'Database file not found. Please contact support.';
    }

    return this.createError(errorType, userMessage, {
      ...context,
      operation,
      originalCode: error.code,
      originalMessage: error.message
    }, error);
  }

  // Handle calculation errors
  handleCalculationError(error, calculationData = {}) {
    return this.createError(
      this.errorTypes.CALCULATION_ERROR,
      `Calculation error: ${error.message}`,
      {
        calculationData,
        originalMessage: error.message
      },
      error
    );
  }

  // Generic error handler with automatic classification
  handleError(error, context = {}) {
    // If already a handled error, return as-is
    if (error.type && Object.values(this.errorTypes).includes(error.type)) {
      return error;
    }

    // Classify error based on characteristics
    if (error.message?.toLowerCase().includes('validation') || error.name === 'ValidationError') {
      return this.handleValidationError({ errors: [error.message] }, context);
    }
    
    if (error.message?.toLowerCase().includes('calculation') || error.name === 'CalculationError') {
      return this.handleCalculationError(error, context);
    }
    
    if (error.status || error.message?.includes('API') || error.message?.includes('OpenAI')) {
      return this.handleAIServiceError(error, context).error;
    }
    
    if (error.code?.startsWith('SQLITE_') || error.message?.includes('database')) {
      return this.handleDatabaseError(error, 'unknown operation', context);
    }

    // Fallback to unknown error
    return this.createError(
      this.errorTypes.UNKNOWN_ERROR,
      'An unexpected error occurred. Please try again.',
      {
        ...context,
        originalMessage: error.message,
        originalName: error.name
      },
      error
    );
  }

  // Log error for debugging (safely, without sensitive data)
  logError(error, additionalContext = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: error.type || 'UNKNOWN',
      message: error.message,
      context: this.sanitizeForLogging({
        ...error.details,
        ...additionalContext
      })
    };

    console.error('🚨 Error:', logEntry);
    
    // In production, you might want to send this to a logging service
    // this.sendToLoggingService(logEntry);
    
    return logEntry;
  }

  // Remove sensitive data from logs
  sanitizeForLogging(data) {
    const sensitiveFields = ['api_key', 'password', 'token', 'email', 'phone', 'address'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  // Retry logic with exponential backoff
  async withRetry(operation, maxRetries = 3, baseDelay = 1000, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const handledError = this.handleError(error, { ...context, attempt });
        
        this.logError(handledError, { attempt, maxRetries });
        
        // Don't retry if it's not a retryable error
        if (!this.isRetryableError(handledError)) {
          throw handledError;
        }
        
        // Don't delay after the last attempt
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    const finalError = this.handleError(lastError, { ...context, finalAttempt: true, maxRetries });
    throw finalError;
  }

  // Determine if an error should be retried
  isRetryableError(error) {
    const retryableTypes = [
      this.errorTypes.NETWORK_ERROR,
      this.errorTypes.RATE_LIMIT_ERROR,
      this.errorTypes.AI_SERVICE_ERROR
    ];
    
    // Don't retry authentication or validation errors
    const nonRetryableTypes = [
      this.errorTypes.AUTHENTICATION_ERROR,
      this.errorTypes.VALIDATION_ERROR
    ];
    
    if (nonRetryableTypes.includes(error.type)) {
      return false;
    }
    
    if (retryableTypes.includes(error.type)) {
      return true;
    }
    
    // Check specific conditions
    if (error.details?.shouldRetry === false) {
      return false;
    }
    
    if (error.originalError?.status >= 500) {
      return true;
    }
    
    return false;
  }

  // Create user-friendly error response
  createErrorResponse(error, includeDetails = false) {
    const handledError = this.handleError(error);
    
    const response = {
      success: false,
      error: handledError.message,
      type: handledError.type,
      timestamp: handledError.timestamp
    };
    
    if (includeDetails && handledError.details) {
      response.details = handledError.details;
    }
    
    return response;
  }

  // Wrap async functions with error handling
  wrapAsync(asyncFunction, context = {}) {
    return async (...args) => {
      try {
        return await asyncFunction(...args);
      } catch (error) {
        const handledError = this.handleError(error, context);
        this.logError(handledError, { functionName: asyncFunction.name, args: this.sanitizeForLogging(args) });
        throw handledError;
      }
    };
  }
}

// Singleton instance
const errorHandler = new ErrorHandler();

export default errorHandler;
export { ErrorHandler };