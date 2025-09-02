import crypto from 'crypto';

class CryptoHelper {
  constructor() {
    // Use a consistent key derivation for the app
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    
    // Get encryption key from environment or generate a default one
    // In production, this should be set via environment variable
    this.masterKey = this.getMasterKey();
  }

  getMasterKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    
    if (envKey) {
      // Use provided key, ensure it's the right length
      return crypto.scryptSync(envKey, 'salt', this.keyLength);
    }
    
    // Generate a consistent key based on system info for development
    // WARNING: This is not secure for production use
    const systemInfo = `${process.env.NODE_ENV || 'development'}-payment-encryption`;
    return crypto.scryptSync(systemInfo, 'xendit-salt', this.keyLength);
  }

  encrypt(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    try {
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.masterKey);
      cipher.setAAD(Buffer.from('xendit-credentials', 'utf8'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
      return combined;
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }

  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return null;
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipher(this.algorithm, this.masterKey);
      decipher.setAAD(Buffer.from('xendit-credentials', 'utf8'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  // Alternative simpler encryption for development/testing
  simpleEncrypt(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    try {
      const cipher = crypto.createCipher('aes192', this.masterKey);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('Simple encryption error:', error);
      return null;
    }
  }

  simpleDecrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return null;
    }

    try {
      const decipher = crypto.createDecipher('aes192', this.masterKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Simple decryption error:', error);
      return null;
    }
  }

  // Hash function for non-reversible data (like webhook tokens for comparison)
  hash(data, salt = 'xendit-hash-salt') {
    if (!data) return null;
    
    try {
      return crypto.scryptSync(data, salt, 64).toString('hex');
    } catch (error) {
      console.error('Hashing error:', error);
      return null;
    }
  }

  // Generate secure random token
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Validate if a string looks like an encrypted value
  isEncrypted(data) {
    if (!data || typeof data !== 'string') return false;
    
    // Check if it has the format of our encrypted data (hex:hex:hex)
    const parts = data.split(':');
    if (parts.length === 3) {
      return parts.every(part => /^[a-f0-9]+$/i.test(part));
    }
    
    // Check if it looks like simple encrypted data (hex string)
    return /^[a-f0-9]+$/i.test(data) && data.length > 20;
  }
}

// Singleton instance
const cryptoHelper = new CryptoHelper();

export default cryptoHelper;