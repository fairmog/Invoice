import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/config.js';

/**
 * Authentication Service for Merchant Users
 * Handles registration, login, password hashing, JWT tokens
 */
class AuthService {
  constructor(database) {
    this.database = database;
    this.jwtSecret = config.security.jwtSecret;
    this.saltRounds = 12; // Strong password hashing
    this.tokenExpiry = '7d'; // 7 days token validity
  }

  /**
   * Register a new merchant user
   */
  async registerMerchant(userData) {
    try {
      const { email, password, businessName, fullName } = userData;

      // Validate input
      if (!email || !password || !businessName) {
        throw new Error('Email, password, and business name are required');
      }

      // Check if user already exists
      const existingUser = await this.database.getMerchant(email);
      if (existingUser) {
        throw new Error('A merchant account with this email already exists');
      }

      // Validate password strength
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, this.saltRounds);

      // Create merchant account
      const merchantData = {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        businessName: businessName.trim(),
        fullName: fullName?.trim() || '',
        status: 'active',
        emailVerified: false,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null
      };

      const merchant = await this.database.createMerchant(merchantData);

      // Generate JWT token
      const token = this.generateToken(merchant);

      // Return user data (without password)
      const { password: _, ...merchantWithoutPassword } = merchant;

      return {
        success: true,
        merchant: merchantWithoutPassword,
        token,
        message: 'Merchant account created successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Login merchant user
   */
  async loginMerchant(email, password, rememberMe = false) {
    try {
      // Get merchant by email
      const merchant = await this.database.getMerchant(email.toLowerCase().trim());
      if (!merchant) {
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (merchant.lockedUntil && new Date(merchant.lockedUntil) > new Date()) {
        const lockTime = Math.ceil((new Date(merchant.lockedUntil) - new Date()) / (1000 * 60));
        throw new Error(`Account locked. Try again in ${lockTime} minutes`);
      }

      // Check if account is active
      if (merchant.status !== 'active') {
        throw new Error('Account is disabled. Contact support');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, merchant.password);
      if (!isPasswordValid) {
        // Increment failed login attempts
        await this.handleFailedLogin(merchant);
        throw new Error('Invalid email or password');
      }

      // Reset failed login attempts and update last login
      await this.database.updateMerchant(merchant.id, {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date().toISOString()
      });

      // Generate JWT token
      const tokenExpiry = rememberMe ? '30d' : this.tokenExpiry;
      const token = this.generateToken(merchant, tokenExpiry);

      // Return user data (without password)
      const { password: _, ...merchantWithoutPassword } = merchant;

      return {
        success: true,
        merchant: merchantWithoutPassword,
        token,
        message: 'Login successful'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle failed login attempts
   */
  async handleFailedLogin(merchant) {
    const attempts = (merchant.loginAttempts || 0) + 1;
    const maxAttempts = 5;
    
    let updateData = { loginAttempts: attempts };
    
    // Lock account after max attempts
    if (attempts >= maxAttempts) {
      const lockDuration = 30 * 60 * 1000; // 30 minutes
      updateData.lockedUntil = new Date(Date.now() + lockDuration).toISOString();
      updateData.loginAttempts = 0; // Reset counter after locking
    }
    
    await this.database.updateMerchant(merchant.id, updateData);
  }

  /**
   * Generate JWT token
   */
  generateToken(merchant, expiry = this.tokenExpiry) {
    const payload = {
      id: merchant.id,
      email: merchant.email,
      businessName: merchant.businessName,
      role: 'merchant'
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: expiry,
      issuer: 'invoice-generator',
      audience: 'merchant'
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
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
        error: error.message
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(merchantId, currentPassword, newPassword) {
    try {
      const merchant = await this.database.getMerchantById(merchantId);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, merchant.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

      // Update password
      await this.database.updateMerchant(merchantId, {
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const merchant = await this.database.getMerchant(email.toLowerCase().trim());
      if (!merchant) {
        // Don't reveal if email exists for security
        return {
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent'
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour

      // Save reset token
      await this.database.updateMerchant(merchant.id, {
        resetToken,
        resetExpiry
      });

      // TODO: Send email with reset link
      console.log(`Password reset requested for ${email}. Token: ${resetToken}`);

      return {
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent',
        resetToken // Remove this in production
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to process password reset request'
      };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Find merchant by reset token
      const merchant = await this.database.getMerchantByResetToken(resetToken);
      if (!merchant) {
        throw new Error('Invalid or expired reset token');
      }

      // Check if token is expired
      if (new Date(merchant.resetExpiry) < new Date()) {
        throw new Error('Reset token has expired');
      }

      // Validate new password
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

      // Update password and clear reset token
      await this.database.updateMerchant(merchant.id, {
        password: hashedPassword,
        resetToken: null,
        resetExpiry: null,
        loginAttempts: 0, // Reset failed attempts
        lockedUntil: null,
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get merchant profile
   */
  async getMerchantProfile(merchantId) {
    try {
      const merchant = await this.database.getMerchantById(merchantId);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      // Return profile without password
      const { password: _, resetToken: __, ...profile } = merchant;
      
      return {
        success: true,
        profile
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update merchant profile
   */
  async updateMerchantProfile(merchantId, updateData) {
    try {
      // Remove sensitive fields
      const { password, resetToken, resetExpiry, ...safeUpdateData } = updateData;
      
      safeUpdateData.updatedAt = new Date().toISOString();

      await this.database.updateMerchant(merchantId, safeUpdateData);

      return {
        success: true,
        message: 'Profile updated successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Logout merchant (client-side token removal)
   */
  logout() {
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }
}

export default AuthService;