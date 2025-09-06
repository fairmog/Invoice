# Email Setup Guide

This guide will help you set up email functionality for the AI Invoice Generator so you can send invoices and payment confirmations.

## Quick Setup (Gmail)

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: https://myaccount.google.com/
2. Click "Security" in the left sidebar
3. Under "Signing in to Google", click "2-Step Verification"
4. Follow the prompts to enable 2FA (required for App Passwords)

### Step 2: Generate App Password

1. Still in Google Account Security settings
2. Click "App passwords" (you may need to sign in again)
3. Select "Mail" from the dropdown
4. Select "Other (custom name)" and enter "AI Invoice Generator"
5. Click "Generate"
6. **Copy the 16-character password** (you'll need this for .env file)

### Step 3: Configure .env File

Open your `.env` file and add these lines:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password

# Enable email notifications
FEATURE_EMAIL_NOTIFICATIONS=true
```

**Replace:**
- `your-email@gmail.com` with your Gmail address
- `your-16-character-app-password` with the App Password from Step 2

### Step 4: Test Email Setup

1. Restart your server: `npm run web`
2. You should see: `📧 Email: ✅ Configured` in the startup logs
3. Test by sending an invoice email from the merchant dashboard

## Alternative Email Providers

### Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo Mail

```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

### Custom SMTP Server

```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
```

## Testing Email Functionality

### Test 1: Check Configuration

```bash
npm run config
```

Look for:
```json
{
  "email": {
    "enabled": true,
    "configured": true
  }
}
```

### Test 2: Send Test Invoice

1. Go to http://localhost:3000/merchant
2. Find an invoice with a customer email
3. Click the "📧 Email" button
4. Check if email was sent successfully

### Test 3: Manual API Test

```bash
curl -X POST http://localhost:3000/api/notifications/send-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": 10,
    "customer_email": "fairmog@gmail.com",
    "include_pdf": true
  }'
```

## Troubleshooting

### Common Issues

1. **"Email service disabled - SMTP credentials not configured"**
   - Check your .env file has SMTP_USER and SMTP_PASS
   - Restart the server after updating .env

2. **"Authentication failed"**
   - For Gmail: Make sure you're using App Password, not regular password
   - For other providers: Check username/password are correct

3. **"Connection refused"**
   - Check SMTP_HOST and SMTP_PORT settings
   - Verify your internet connection

4. **"Email not received"**
   - Check spam/junk folder
   - Verify recipient email address is correct
   - Check server logs for error messages

### Debug Mode

Add this to your .env file for detailed email debugging:

```env
DEBUG_MODE=true
NODE_DEBUG=nodemailer
```

## Email Templates

The system sends these types of emails:

### 1. Invoice Delivery Email
- Sent when new invoices are created
- Includes PDF attachment
- Contains customer portal link

### 2. Payment Confirmation Email
- Sent when payments are processed
- Contains payment details
- Confirms invoice is paid

### 3. Status Update Email
- Sent when invoice status changes
- Notifies customer of changes

## Security Best Practices

1. **Use App Passwords**: Never use your main email password
2. **Secure .env File**: Never commit .env file to version control
3. **Regular Updates**: Rotate App Passwords periodically
4. **Monitor Usage**: Check email logs for unusual activity

## Production Deployment

For production, consider using:
- **SendGrid** - Professional email service
- **Mailgun** - Transactional email API
- **Amazon SES** - AWS email service
- **Postmark** - Reliable email delivery

## Need Help?

If you're still having issues:
1. Check the server logs in your terminal
2. Verify your email provider's SMTP settings
3. Test with a simple email client first
4. Contact your email provider's support

## Quick Copy-Paste Template

Here's a complete email configuration template for your .env file:

```env
# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password

# Enable email notifications
FEATURE_EMAIL_NOTIFICATIONS=true

# Optional: Merchant email override
MERCHANT_EMAIL=your-business-email@gmail.com
```

Replace the placeholders with your actual values and restart the server!