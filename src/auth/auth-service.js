import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/config.js';

/**
 * Authentication Service for Merchant Users
 * Handles registration, login, password hashing, JWT tokens
 */
class AuthService {
  constructor(database, emailService = null) {
    this.database = database;
    this.emailService = emailService;
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

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Create merchant account
      const merchantData = {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        businessName: businessName.trim(),
        fullName: fullName?.trim() || '',
        status: 'active',
        emailVerified: false,
        emailVerificationToken: emailVerificationToken,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null
      };

      const merchant = await this.database.createMerchant(merchantData);

            // Create default business settings for the new merchant
            try {
              const defaultBusinessSettings = {
                name: businessName.trim(),
                email: email.toLowerCase().trim(),
                merchant_id: merchant.id
              };
              
              await this.database.updateBusinessSettings(defaultBusinessSettings, merchant.id);
              console.log(`✅ Created default business settings for merchant ${merchant.id} (${email})`);
            } catch (settingsError) {
              console.error(`⚠️ Failed to create business settings for new merchant ${merchant.id}:`, settingsError);
              // Continue without failing registration - settings can be created later
            }

      // Send email verification email
      if (this.emailService) {
        try {
          const emailResult = await this.emailService.sendEmailVerificationEmail(
            merchant.email, 
            emailVerificationToken, 
            businessName
          );
          console.log(`📧 Email verification result for ${email}:`, emailResult.success ? 'Sent' : 'Failed');
        } catch (emailError) {
          console.error('📧 Failed to send email verification:', emailError);
          // Continue without failing registration
        }
      } else {
        console.log('⚠️ Email service not configured - email verification not sent');
      }

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

      // Save reset token (using snake_case for database fields)
      await this.database.updateMerchant(merchant.id, {
        reset_token: resetToken,
        reset_expiry: resetExpiry
      });

      // Send password reset email
      if (this.emailService) {
        try {
          const businessName = merchant.businessName || 'AI Invoice Generator';
          const emailResult = await this.emailService.sendPasswordResetEmail(
            merchant.email, 
            resetToken, 
            businessName
          );
          
          console.log(`📧 Password reset email result for ${email}:`, emailResult.success ? 'Sent' : 'Failed');
        } catch (emailError) {
          console.error('📧 Failed to send password reset email:', emailError);
          // Continue without failing the request for security
        }
      } else {
        console.log(`Password reset requested for ${email}. Token: ${resetToken}`);
        console.log('⚠️ Email service not configured - password reset email not sent');
      }

      return {
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent',
        // Remove resetToken in production for security
        ...(process.env.NODE_ENV !== 'production' && { resetToken })
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

      // Update password and clear reset token (using snake_case for database fields)
      await this.database.updateMerchant(merchant.id, {
        password: hashedPassword,
        reset_token: null,
        reset_expiry: null,
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
   * Verify email with token
   */
  async verifyEmail(verificationToken) {
    try {
      const merchant = await this.database.getMerchantByEmailVerificationToken(verificationToken);
      if (!merchant) {
        throw new Error('Invalid or expired verification token');
      }

      // Update merchant as email verified
      await this.database.updateMerchant(merchant.id, {
        emailVerified: true,
        emailVerificationToken: null,
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Email verified successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(email) {
    try {
      const merchant = await this.database.getMerchant(email.toLowerCase().trim());
      if (!merchant) {
        // Don't reveal if email exists for security
        return {
          success: true,
          message: 'If an account with this email exists, a verification email has been sent'
        };
      }

      if (merchant.emailVerified) {
        return {
          success: false,
          error: 'Email is already verified'
        };
      }

      // Generate new verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Update merchant with new token
      await this.database.updateMerchant(merchant.id, {
        emailVerificationToken: emailVerificationToken,
        updatedAt: new Date().toISOString()
      });

      // Send email verification email
      if (this.emailService) {
        try {
          const emailResult = await this.emailService.sendEmailVerificationEmail(
            merchant.email, 
            emailVerificationToken, 
            merchant.businessName || 'AI Invoice Generator'
          );
          console.log(`📧 Email verification resend result for ${email}:`, emailResult.success ? 'Sent' : 'Failed');
        } catch (emailError) {
          console.error('📧 Failed to resend email verification:', emailError);
        }
      }

      return {
        success: true,
        message: 'If an account with this email exists, a verification email has been sent'
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to resend email verification'
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
