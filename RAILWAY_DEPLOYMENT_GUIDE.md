# 🚂 Railway.app Deployment Guide - AI Invoice Generator

## Prerequisites ✅
- [x] Railway.json configuration created
- [x] Environment variables prepared  
- [x] Package.json start script verified
- [x] Production configuration ready

## Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended) or email
3. Verify your account

## Step 2: Deploy Your Application

### Option A: From GitHub (Recommended)
1. **Connect Repository**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select your AI Invoice Generator repository

2. **Automatic Deployment**:
   - Railway will automatically detect it's a Node.js app
   - It will use our `railway.json` configuration
   - The build will start automatically

### Option B: Direct Upload
1. **Install Railway CLI** (if you prefer):
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```

## Step 3: Configure Environment Variables

In Railway Dashboard, go to your project → Variables tab and add these:

### Required Variables:
```bash
NODE_ENV=production
HOST=0.0.0.0

# AI Configuration (REQUIRED - Update with your keys)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Email Configuration (REQUIRED - Update with your credentials)
FEATURE_EMAIL_NOTIFICATIONS=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=aspree.id@gmail.com
SMTP_PASS=your_gmail_app_password_here

# Security (REQUIRED - Generate new secrets)
JWT_SECRET=generate_a_strong_random_string_here_32_characters_minimum
SESSION_SECRET=generate_another_strong_random_string_here_32_chars_min

# Features
FEATURE_PAYMENT_GATEWAY=true
FEATURE_WHATSAPP_INTEGRATION=true
FEATURE_PDF_GENERATION=true
FEATURE_ANALYTICS=true

# Railway Specific
SSL_ENABLED=false
ENABLE_CORS=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
DB_TYPE=json
DB_JSON_PATH=./database.json
LOG_LEVEL=info
```

### Optional Variables (for payment processing):
```bash
MIDTRANS_ENVIRONMENT=sandbox
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_CLIENT_KEY=your_midtrans_client_key
```

## Step 4: Update BASE_URL After Deployment

1. **Get Your Railway URL**: After deployment, Railway will provide a URL like:
   ```
   https://ai-invoice-generator-production-abc123.railway.app
   ```

2. **Update BASE_URL**: In Railway dashboard, add/update:
   ```bash
   BASE_URL=https://your-actual-railway-url.railway.app
   CORS_ORIGIN=https://your-actual-railway-url.railway.app
   ```

3. **Redeploy**: Railway will automatically redeploy after environment variable changes

## Step 5: Verify Deployment

### Test These Features:
1. **✅ Application loads**: Visit your Railway URL
2. **✅ Login system**: Try logging in with your Bevelient credentials:
   - Email: `bevelient@gmail.com` 
   - Password: `Bevelient2024!`
3. **✅ Invoice generation**: Test creating an invoice
4. **✅ Business settings**: Check settings page works
5. **✅ Email functionality**: Test email sending

### Check Railway Metrics:
- Go to Railway dashboard → your project
- Check "Metrics" tab for performance
- Check "Logs" tab for any errors

## Step 6: Set Up Custom Domain (Optional)

1. **In Railway Dashboard**:
   - Go to Settings → Custom Domain
   - Add your domain (e.g., `invoices.bevelient.com`)
   
2. **Update DNS**: Add CNAME record:
   ```
   CNAME: invoices → your-app.railway.app
   ```

3. **Update Environment Variables**:
   ```bash
   BASE_URL=https://invoices.bevelient.com
   CORS_ORIGIN=https://invoices.bevelient.com
   ```

## Security Checklist ✅

- [ ] Generated new JWT_SECRET (32+ characters)
- [ ] Generated new SESSION_SECRET (32+ characters)  
- [ ] Updated SMTP credentials with app passwords
- [ ] Verified OPENAI_API_KEY is correct
- [ ] CORS_ORIGIN matches your domain
- [ ] SSL_ENABLED=false (Railway provides HTTPS)

## Estimated Costs 💰

- **Free tier**: Limited hours/month (good for testing)
- **Production**: ~$5/month for basic usage
- **Higher traffic**: Pay-as-you-scale

## Troubleshooting

### Common Issues:
1. **Build fails**: Check package.json start script
2. **App crashes**: Check Railway logs for errors
3. **Login doesn't work**: Verify JWT_SECRET is set
4. **Emails don't send**: Check SMTP credentials

### Getting Help:
- Railway Discord community
- Check Railway documentation
- Monitor Railway logs for specific errors

## Success! 🎉

Once deployed, your AI Invoice Generator will be:
- ✅ Live on the internet with HTTPS
- ✅ Accessible to your clients
- ✅ Automatically backed up by Railway
- ✅ Scalable based on usage

**Your Bevelient Invoice Generator is now production-ready!**