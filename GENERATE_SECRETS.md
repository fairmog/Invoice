# 🔐 Generate Production Secrets

Before deploying to Railway, you need to generate secure secrets. Here are some options:

## Generate JWT and Session Secrets

### Option 1: Using Node.js (Recommended)
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Option 2: Using OpenSSL
```bash
openssl rand -hex 32
```

### Option 3: Online Generator
Visit: https://www.grc.com/passwords.htm and use the "63 random printable ASCII characters" option.

## Example Strong Secrets (DO NOT USE THESE - Generate your own!)
```bash
# NEVER use these examples - they are public!
JWT_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
SESSION_SECRET=f9e8d7c6b5a4321098765432109876543210fedcba9876543210fedcba987654
```

## Gmail App Password Setup

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Go to Google Account Settings** → Security → 2-Step Verification
3. **Generate App Password**:
   - Select "Mail" as the app
   - Select "Other" as the device
   - Name it "Bevelient Invoice Generator"
   - Copy the generated password (16 characters)

## Environment Variables Quick Copy

Replace the placeholder values and paste into Railway:

```bash
NODE_ENV=production
HOST=0.0.0.0
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4o-mini
SMTP_USER=bevelient@gmail.com
SMTP_PASS=your_gmail_app_password_here
JWT_SECRET=your_generated_jwt_secret_here
SESSION_SECRET=your_generated_session_secret_here
FEATURE_EMAIL_NOTIFICATIONS=true
FEATURE_PAYMENT_GATEWAY=true
FEATURE_WHATSAPP_INTEGRATION=true
SSL_ENABLED=false
ENABLE_CORS=true
DB_TYPE=json
LOG_LEVEL=info
```

**Remember**: Never commit secrets to Git! Railway dashboard is the secure place to store them.