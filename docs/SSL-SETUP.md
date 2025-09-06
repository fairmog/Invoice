# SSL/HTTPS Setup Guide

This guide explains how to set up SSL/HTTPS for the AI Invoice Generator.

## Overview

The AI Invoice Generator supports both HTTP and HTTPS modes:
- **HTTP Mode**: Default for development, no SSL certificates required
- **HTTPS Mode**: Secure communication with SSL certificates

## Quick Start

### Option 1: Automatic Setup (Recommended)

```bash
# Run the SSL setup script
npm run ssl-setup

# Follow the interactive prompts to generate certificates
```

### Option 2: Manual Setup

1. **Generate Self-Signed Certificate (Development)**:
   ```bash
   mkdir -p ssl
   openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=ID/ST=Jakarta/L=Jakarta/O=AI Invoice Generator/CN=localhost"
   ```

2. **Enable SSL in .env**:
   ```env
   SSL_ENABLED=true
   SSL_CERT_PATH=./ssl/cert.pem
   SSL_KEY_PATH=./ssl/key.pem
   ```

3. **Start the server**:
   ```bash
   npm run web
   ```

## SSL Certificate Types

### 1. Self-Signed Certificates (Development)

**Pros:**
- Free and instant
- Perfect for development
- No external dependencies

**Cons:**
- Browser security warnings
- Not trusted by default
- Not suitable for production

**When to use:**
- Local development
- Testing HTTPS functionality
- Internal applications

### 2. CA-Signed Certificates (Production)

**Pros:**
- Trusted by browsers
- No security warnings
- Professional appearance

**Cons:**
- Costs money
- Requires domain validation
- Renewal process

**When to use:**
- Production deployment
- Public-facing applications
- E-commerce sites

## Production SSL Setup

### Step 1: Obtain SSL Certificate

Choose one of these Certificate Authorities:
- **Let's Encrypt** (Free, automated)
- **Cloudflare** (Free with their service)
- **DigiCert** (Paid, enterprise-grade)
- **Comodo** (Paid, budget-friendly)

### Step 2: Generate CSR (Certificate Signing Request)

```bash
# Use the SSL setup script
npm run ssl-setup

# Or manually:
openssl genrsa -out ssl/key.pem 2048
openssl req -new -key ssl/key.pem -out ssl/cert.csr
```

### Step 3: Install Certificate

1. Submit CSR to your Certificate Authority
2. Download the signed certificate
3. Save it as `ssl/cert.pem`
4. Configure production environment:

```env
# Production configuration
NODE_ENV=production
SSL_ENABLED=true
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem
BASE_URL=https://yourdomain.com
```

## Configuration Options

### Environment Variables

```env
# SSL Configuration
SSL_ENABLED=true|false
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem

# Server Configuration
PORT=443  # Standard HTTPS port
BASE_URL=https://yourdomain.com
```

### Automatic HTTP to HTTPS Redirect

In production mode, the server automatically:
1. Starts HTTPS server on port 443
2. Starts HTTP server on port 80 for redirects
3. Redirects all HTTP traffic to HTTPS

## Security Headers

The application automatically adds security headers in production:

```javascript
// Security headers added automatically
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Troubleshooting

### Common Issues

1. **Certificate Not Found**
   ```
   ❌ SSL certificates not found
   ```
   **Solution**: Run `npm run ssl-setup` or check certificate paths

2. **Permission Errors**
   ```
   ❌ Failed to load SSL certificates
   ```
   **Solution**: Check file permissions
   ```bash
   chmod 600 ssl/key.pem
   chmod 644 ssl/cert.pem
   ```

3. **Port Already in Use**
   ```
   ❌ Port 443 is already in use
   ```
   **Solution**: Change port or stop conflicting service
   ```bash
   # Check what's using port 443
   sudo lsof -i :443
   
   # Use different port
   PORT=8443 npm run web
   ```

4. **Browser Security Warning**
   ```
   Your connection is not private
   ```
   **Solution**: For self-signed certificates, click "Advanced" → "Proceed to localhost"

### Certificate Validation

Check certificate validity:

```bash
# Validate certificate
openssl x509 -in ssl/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in ssl/cert.pem -noout -dates

# Verify certificate matches private key
openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
```

## Support

For SSL-related issues:
- Check server logs for SSL errors
- Verify certificate validity
- Ensure proper file permissions
- Contact your Certificate Authority for certificate issues

## Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [OpenSSL Documentation](https://www.openssl.org/docs/)