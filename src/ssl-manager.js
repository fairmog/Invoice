import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SSLManager {
  constructor() {
    this.sslConfig = config.ssl;
    this.certPath = this.sslConfig.certPath;
    this.keyPath = this.sslConfig.keyPath;
    this.sslEnabled = this.sslConfig.enabled;
  }

  async setupSSL() {
    if (!this.sslEnabled) {
      console.log('🔒 SSL is disabled in configuration');
      return false;
    }

    try {
      // Check if SSL certificates exist
      const certExists = fs.existsSync(this.certPath);
      const keyExists = fs.existsSync(this.keyPath);

      if (!certExists || !keyExists) {
        console.log('⚠️  SSL certificates not found. SSL will be disabled.');
        console.log(`   Certificate path: ${this.certPath}`);
        console.log(`   Key path: ${this.keyPath}`);
        return false;
      }

      console.log('✅ SSL certificates found and ready');
      return true;
    } catch (error) {
      console.error('❌ Error setting up SSL:', error.message);
      return false;
    }
  }

  loadCertificates() {
    if (!this.sslEnabled) {
      return { cert: null, key: null };
    }

    try {
      const cert = fs.readFileSync(this.certPath);
      const key = fs.readFileSync(this.keyPath);
      return { cert, key };
    } catch (error) {
      console.error('❌ Error loading SSL certificates:', error.message);
      return { cert: null, key: null };
    }
  }

  printSSLStatus() {
    if (this.sslEnabled) {
      const certExists = fs.existsSync(this.certPath);
      const keyExists = fs.existsSync(this.keyPath);
      
      console.log('🔒 SSL Status:');
      console.log(`   Enabled: ${this.sslEnabled ? '✅ Yes' : '❌ No'}`);
      console.log(`   Certificate: ${certExists ? '✅ Found' : '❌ Missing'}`);
      console.log(`   Private Key: ${keyExists ? '✅ Found' : '❌ Missing'}`);
    } else {
      console.log('🔒 SSL: Disabled');
    }
  }

  isSSLReady() {
    if (!this.sslEnabled) return false;
    
    const certExists = fs.existsSync(this.certPath);
    const keyExists = fs.existsSync(this.keyPath);
    
    return certExists && keyExists;
  }
}

export default SSLManager; 