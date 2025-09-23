import jwt from 'jsonwebtoken';
import config from '../../config/config.js';

/**
 * Authentication Middleware for Merchant Routes
 * Handles JWT token verification and user authentication
 */

// JWT secret from config
const jwtSecret = config.security.jwtSecret;

/**
 * Middleware to verify JWT token and authenticate merchant
 */
export function authenticateMerchant(req, res, next) {
  try {
    // Get token from various sources
    const token = getTokenFromRequest(req);

    if (!token) {
      return handleAuthFailure(res, 'Authentication required');
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, jwtSecret, {
        issuer: 'invoice-generator',
        audience: 'merchant'
      });

      // Add merchant info to request
      req.merchant = {
        id: decoded.id,
        email: decoded.email,
        businessName: decoded.businessName,
        role: decoded.role
      };

      // Add token to request for potential refresh
      req.token = token;

      next();

    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return handleAuthFailure(res, 'Token expired', 'TOKEN_EXPIRED');
      } else if (jwtError.name === 'JsonWebTokenError') {
        return handleAuthFailure(res, 'Invalid token', 'INVALID_TOKEN');
      } else {
        return handleAuthFailure(res, 'Token verification failed', 'TOKEN_ERROR');
      }
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication system error'
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export function optionalAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, jwtSecret, {
          issuer: 'invoice-generator',
          audience: 'merchant'
        });

        req.merchant = {
          id: decoded.id,
          email: decoded.email,
          businessName: decoded.businessName,
          role: decoded.role
        };
        req.token = token;
      } catch (jwtError) {
        // Token exists but is invalid - clear it
        req.merchant = null;
        req.token = null;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without auth
  }
}

/**
 * Middleware to check if merchant is already authenticated
 * Redirects to dashboard if already logged in
 */
export function redirectIfAuthenticated(req, res, next) {
  try {
    // Check for redirect loop prevention
    if (req.query.from === 'merchant') {
      // Clear invalid tokens to prevent loops
      res.clearCookie('merchantToken');
      return next();
    }

    const token = getTokenFromRequest(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, jwtSecret, {
          issuer: 'invoice-generator',
          audience: 'merchant'
        });

        // Valid token - redirect to dashboard
        if (req.path.includes('/api/')) {
          return res.json({
            success: true,
            redirect: '/merchant',
            message: 'Already authenticated'
          });
        } else {
          return res.redirect('/merchant');
        }
      } catch (jwtError) {
        // Invalid token - clear it and continue to login/register
        res.clearCookie('merchantToken');
        next();
      }
    } else {
      next();
    }
  } catch (error) {
    console.error('Redirect auth middleware error:', error);
    next();
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.merchant) {
      return handleAuthFailure(res, 'Authentication required');
    }

    if (req.merchant.role !== role) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

/**
 * Middleware to validate merchant account status
 */
export function validateMerchantStatus(database) {
  return async (req, res, next) => {
    try {
      if (!req.merchant || !req.merchant.id) {
        return handleAuthFailure(res, 'Authentication required');
      }

      // Get merchant from database to check current status
      const merchant = await database.getMerchantById(req.merchant.id);
      
      if (!merchant) {
        return handleAuthFailure(res, 'Merchant account not found', 'ACCOUNT_NOT_FOUND');
      }

      if (merchant.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Account is disabled. Contact support.',
          code: 'ACCOUNT_DISABLED'
        });
      }

      // Check if account is locked
      if (merchant.lockedUntil && new Date(merchant.lockedUntil) > new Date()) {
        const lockTime = Math.ceil((new Date(merchant.lockedUntil) - new Date()) / (1000 * 60));
        return res.status(423).json({
          success: false,
          error: `Account locked. Try again in ${lockTime} minutes`,
          code: 'ACCOUNT_LOCKED'
        });
      }

      // Add full merchant data to request
      req.merchantData = merchant;
      next();

    } catch (error) {
      console.error('Merchant status validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to validate account status'
      });
    }
  };
}

/**
 * API rate limiting middleware for auth endpoints
 */
export function authRateLimit() {
  const attempts = new Map();
  const maxAttempts = 50; // Increased from 5 to allow normal usage
  const windowMs = 15 * 60 * 1000; // 15 minutes

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    // Clean old attempts
    const cutoff = now - windowMs;
    if (attempts.has(key)) {
      const userAttempts = attempts.get(key).filter(time => time > cutoff);
      attempts.set(key, userAttempts);
    }

    // Check current attempts
    const currentAttempts = attempts.get(key) || [];
    
    if (currentAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((currentAttempts[0] + windowMs - now) / 1000)
      });
    }

    // Add current attempt
    currentAttempts.push(now);
    attempts.set(key, currentAttempts);

    next();
  };
}

/**
 * Middleware to log authentication events
 */
export function logAuthEvent(eventType) {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      try {
        const merchant = req.merchant || {};
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'unknown';
        
        let success = false;
        let error = null;
        
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          success = responseData.success === true;
          error = responseData.error || null;
        } catch (e) {
          // Could not parse response
        }

        console.log(`🔐 Auth Event: ${eventType}`, {
          merchantId: merchant.id || 'unknown',
          merchantEmail: merchant.email || req.body?.email || 'unknown',
          success,
          error,
          ip,
          userAgent: userAgent.substring(0, 100), // Limit length
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error logging auth event:', error);
      }
      
      originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Extract token from various request sources
 */
function getTokenFromRequest(req) {
  let token = null;

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // Check cookies
  if (!token && req.cookies && req.cookies.merchantToken) {
    token = req.cookies.merchantToken;
  }
  
  // Check query parameter (for links)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  return token;
}

/**
 * Handle authentication failures consistently
 */
function handleAuthFailure(res, message, code = 'AUTH_REQUIRED') {
  const isApiRequest = res.req.path.startsWith('/api/');

  if (isApiRequest) {
    return res.status(401).json({
      success: false,
      error: message,
      code: code
    });
  } else {
    // Clear all possible token storage to prevent session corruption
    res.clearCookie('merchantToken');

    // Set headers to clear browser storage
    res.set('Clear-Site-Data', '"storage"');

    // Add comprehensive loop prevention
    const redirectUrl = res.req.originalUrl;
    const isFromMerchant = res.req.query?.from === 'merchant' || res.req.query?.from === 'dashboard';
    const isLoginPage = redirectUrl.includes('/auth/login');

    // Prevent redirect loops
    if (isLoginPage || isFromMerchant) {
      return res.redirect('/auth/login');
    }

    // Add session cleanup indication for client-side
    const loginUrl = `/auth/login?redirect=${encodeURIComponent(redirectUrl)}&from=merchant&cleanup=true`;

    return res.redirect(loginUrl);
  }
}

/**
 * Utility function to generate JWT token (for use in auth service)
 */
export function generateToken(payload, options = {}) {
  const defaultOptions = {
    expiresIn: '7d',
    issuer: 'invoice-generator',
    audience: 'merchant'
  };

  return jwt.sign(payload, jwtSecret, { ...defaultOptions, ...options });
}

/**
 * Utility function to verify JWT token
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'invoice-generator',
      audience: 'merchant'
    });
    
    return {
      success: true,
      payload: decoded
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.name
    };
  }
}

// Default export with all middleware functions
export default {
  authenticateMerchant,
  optionalAuth,
  redirectIfAuthenticated,
  requireRole,
  validateMerchantStatus,
  authRateLimit,
  logAuthEvent,
  generateToken,
  verifyToken
};
