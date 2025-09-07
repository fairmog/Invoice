import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import config from '../config/config.js';

class SimpleEmailService {
  constructor() {
    this.transporter = null;
    this.fallbackTransporter = null;
    this.isConfigured = false;
    this.isFallbackConfigured = false;
    this.config = this.loadConfig();
    this.fallbackConfig = this.loadConfig();
  }

  loadConfig() {
    // Try to load from .env - check SAAS_SMTP first, then SMTP as fallback
    return {
      host: process.env.SAAS_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SAAS_SMTP_PORT || process.env.SMTP_PORT) || 587,
      secure: (process.env.SAAS_SMTP_SECURE || process.env.SMTP_SECURE) === 'true' || false,
      user: process.env.SAAS_SMTP_USER || process.env.SMTP_USER || '',
      pass: (process.env.SAAS_SMTP_PASS || process.env.SMTP_PASS || '').replace(/\s/g, '')
    };
  }

  async initialize() {
    console.log('📧 Initializing simple email service...');
    console.log('📧 Config:', {
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      passLength: this.config.pass ? this.config.pass.length : 0
    });
    
    // Check if we have valid credentials
    if (!this.config.user || !this.config.pass || 
        this.config.user.includes('your-') || this.config.pass.includes('your-')) {
      console.log('⚠️ Email credentials not configured - running in mock mode');
      console.log('⚠️ User:', this.config.user);
      console.log('⚠️ Pass length:', this.config.pass ? this.config.pass.length : 0);
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass
        }
      });

      // Test connection
      await this.transporter.verify();
      console.log('✅ Email service connected:', this.config.user);
      this.isConfigured = true;
      
    } catch (error) {
      console.error('❌ Email service failed:', error.message);
      this.transporter = null;
      this.isConfigured = false;
    }
  }

  async updateConfig(newConfig) {
    console.log('📧 Updating email configuration...');
    
    // Update config
    this.config = {
      host: newConfig.host || this.config.host,
      port: newConfig.port || this.config.port,
      secure: newConfig.secure !== undefined ? newConfig.secure : this.config.secure,
      user: newConfig.user || this.config.user,
      pass: newConfig.pass || this.config.pass
    };

    // Update environment variables
    process.env.SMTP_HOST = this.config.host;
    process.env.SMTP_PORT = this.config.port.toString();
    process.env.SMTP_SECURE = this.config.secure.toString();
    process.env.SMTP_USER = this.config.user;
    process.env.SMTP_PASS = this.config.pass;

    // Reinitialize
    await this.initialize();
    return this.isConfigured;
  }

  async sendInvoiceEmail(invoice, customerEmail, pdfBuffer = null, businessSettings = null) {
    if (!this.isConfigured) {
      return this.sendMockEmail('Invoice', invoice, customerEmail, pdfBuffer);
    }

    try {
      const merchantName = businessSettings?.name || invoice.merchant_name || 'Invoice System';
      const subject = `Invoice ${invoice.invoice_number} - ${merchantName}`;
      const html = this.generateInvoiceEmailHTML(invoice, businessSettings);

      const mailOptions = {
        from: {
          name: merchantName,
          address: this.config.user
        },
        to: customerEmail,
        subject: subject,
        html: html
      };

      // Add PDF attachment if provided
      if (pdfBuffer) {
        mailOptions.attachments = [{
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }];
      }

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Invoice email sent to:', customerEmail, 'MessageID:', info.messageId);
      
      return { 
        success: true, 
        messageId: info.messageId,
        recipient: customerEmail
      };

    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      return { 
        success: false, 
        error: error.message,
        fallback: await this.sendMockEmail('Invoice', invoice, customerEmail, pdfBuffer)
      };
    }
  }

  async sendFinalPaymentEmail(invoice, customerEmail, finalPaymentUrl, businessSettings = null) {
    if (!this.isConfigured) {
      return this.sendMockFinalPaymentEmail(invoice, customerEmail, finalPaymentUrl);
    }

    try {
      const merchantName = businessSettings?.name || invoice.merchant_name || 'Invoice System';
      const subject = `Invoice ${invoice.invoice_number} - ${merchantName}`;
      const html = this.generateInvoiceEmailHTML(invoice, businessSettings);

      const mailOptions = {
        from: {
          name: merchantName,
          address: this.config.user
        },
        to: customerEmail,
        subject: subject,
        html: html
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Final payment email sent to:', customerEmail, 'MessageID:', info.messageId);
      
      return { 
        success: true, 
        messageId: info.messageId,
        recipient: customerEmail
      };

    } catch (error) {
      console.error('❌ Failed to send final payment email:', error.message);
      return { 
        success: false, 
        error: error.message,
        fallback: await this.sendMockFinalPaymentEmail(invoice, customerEmail, finalPaymentUrl)
      };
    }
  }

  async sendTestEmail(testEmail) {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: {
          name: 'AI Invoice Generator Test',
          address: this.config.user
        },
        to: testEmail,
        subject: '🧪 Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #4CAF50; border-radius: 8px; max-width: 500px;">
            <h2 style="color: #4CAF50;">✅ Email Test Successful!</h2>
            <p>Your email configuration is working correctly.</p>
            <hr>
            <p><strong>Configuration:</strong></p>
            <ul>
              <li>Host: ${this.config.host}</li>
              <li>Port: ${this.config.port}</li>
              <li>Security: ${this.config.secure ? 'SSL/TLS' : 'STARTTLS'}</li>
              <li>From: ${this.config.user}</li>
            </ul>
            <p><em>Test sent at: ${new Date().toLocaleString()}</em></p>
          </div>
        `
      });

      return { 
        success: true, 
        messageId: info.messageId,
        message: 'Test email sent successfully'
      };

    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  async sendMockEmail(type, invoice, customerEmail, attachment = null) {
    console.log('\n📧 =============== MOCK EMAIL ===============');
    console.log(`📧 Type: ${type}`);
    console.log(`📧 To: ${customerEmail}`);
    console.log(`📧 From: ${invoice.merchant_name} <${this.config.user || 'not-configured@example.com'}>`);
    console.log(`📧 Subject: Invoice ${invoice.invoice_number}`);
    console.log(`📧 Amount: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(invoice.grand_total)}`);
    console.log(`📧 Customer: ${invoice.customer_name}`);
    if (attachment) {
      console.log(`📧 Attachment: PDF invoice file`);
    }
    console.log('📧 ==========================================\n');
    
    return { 
      success: true, 
      messageId: `mock_${Date.now()}`, 
      mode: 'mock',
      note: 'Email sent in mock mode - check console for details' 
    };
  }

  async sendMockFinalPaymentEmail(invoice, customerEmail, finalPaymentUrl) {
    console.log('\n📧 ============ MOCK FINAL PAYMENT EMAIL ============');
    console.log(`📧 Type: Final Payment`);
    console.log(`📧 To: ${customerEmail}`);
    console.log(`📧 From: ${invoice.merchant_name} <${this.config.user || 'not-configured@example.com'}>`);
    console.log(`📧 Subject: Final Payment Required - Invoice ${invoice.invoice_number}`);
    console.log(`📧 Final Payment Amount: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(invoice.final_payment_amount)}`);
    console.log(`📧 Customer: ${invoice.customer_name}`);
    console.log(`📧 Payment Link: ${finalPaymentUrl}`);
    console.log('📧 ================================================\n');
    
    return { 
      success: true, 
      messageId: `mock_final_payment_${Date.now()}`, 
      mode: 'mock',
      note: 'Final payment email sent in mock mode - check console for details' 
    };
  }

  generateInvoiceEmailHTML(invoice, businessSettings = null) {
    const baseUrl = config.server.baseUrl;
    // Include both invoice ID and token for proper invoice loading
    const invoiceUrl = `${baseUrl}/invoice?id=${invoice.invoice_number}&token=${invoice.customer_token}`;
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(invoice.grand_total);

    // Use business settings if available, otherwise fall back to invoice/env data
    const businessName = businessSettings?.name || invoice.merchant_name || process.env.MERCHANT_NAME || 'Your Business';
    const businessAddress = businessSettings?.address || invoice.merchant_address || process.env.MERCHANT_ADDRESS || '';
    const businessPhone = businessSettings?.phone || invoice.merchant_phone || process.env.MERCHANT_PHONE || '';
    const businessEmail = businessSettings?.email || invoice.merchant_email || process.env.MERCHANT_EMAIL || '';
    const businessWebsite = businessSettings?.website || process.env.MERCHANT_WEBSITE || '';
    
    // Construct absolute logo URL for email clients
    let businessLogo = null;
    const logoPath = businessSettings?.logo;
    console.log('📧 ===== EMAIL LOGO CONSTRUCTION DEBUG =====');
    console.log('📧 baseUrl used:', baseUrl);
    console.log('📧 businessSettings:', businessSettings ? {
      name: businessSettings.name,
      logo: businessSettings.logo,
      logoUrl: businessSettings.logoUrl
    } : 'null');
    console.log('📧 logoPath extracted:', logoPath);
    
    if (logoPath) {
      // If logo is already absolute URL or data URL, use as is
      if (logoPath.startsWith('http') || logoPath.startsWith('data:')) {
        businessLogo = logoPath;
        console.log('📧 ✅ Using absolute/data URL as-is:', businessLogo);
      } else {
        // Convert relative path to absolute URL
        const cleanPath = logoPath.replace(/^\//, '');
        businessLogo = `${baseUrl}/${cleanPath}`;
        console.log('📧 ✅ Converted relative to absolute:', {
          original: logoPath,
          cleaned: cleanPath,
          final: businessLogo
        });
      }
    } else {
      // Default to Aspree logo if no business logo is provided
      businessLogo = `${baseUrl}/aspree2-logo.png?v=2`;
      console.log('📧 ⚠️ Using default Aspree logo (no business logo provided):', businessLogo);
    }
    
    // Validate the constructed URL
    try {
      new URL(businessLogo);
      console.log('📧 ✅ Logo URL is valid:', businessLogo);
    } catch (error) {
      console.error('📧 ❌ Invalid logo URL constructed:', businessLogo, error.message);
      // Fallback to default logo with base URL
      businessLogo = `${baseUrl}/aspree2-logo.png?v=2`;
      console.log('📧 🔧 Fallback to default logo:', businessLogo);
    }
    
    console.log('📧 ===== FINAL LOGO URL =====', businessLogo);
    console.log('📧 ==========================================');

    // Parse invoice items
    let items = [];
    try {
      if (Array.isArray(invoice.items_json)) {
        items = invoice.items_json;
      } else if (typeof invoice.items_json === 'string') {
        items = JSON.parse(invoice.items_json);
      }
    } catch (e) {
      console.error('Error parsing items:', e);
      items = [];
    }

    // Parse payment schedule if exists
    let paymentSchedule = null;
    try {
      if (invoice.payment_schedule_json) {
        paymentSchedule = typeof invoice.payment_schedule_json === 'string' 
          ? JSON.parse(invoice.payment_schedule_json) 
          : invoice.payment_schedule_json;
      }
    } catch (e) {
      console.error('Error parsing payment schedule:', e);
    }

    // Format items list with proper field name handling
    let itemsList = '';
    if (items.length > 0) {
      itemsList = items.map((item, index) => {
        const qty = item.quantity || 0;
        const price = item.unit_price || item.unitPrice || 0;
        const total = item.line_total || item.lineTotal || (qty * price);
        const productName = item.product_name || item.productName || 'Produk';
        return `
          <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #E2E8F0;">
            <div>
              <div style="font-weight: 600; color: #2D3748;">${productName}</div>
              <div style="color: #718096; font-size: 14px;">${qty}x @ Rp ${price.toLocaleString('id-ID')}</div>
            </div>
            <div style="font-weight: 600; color: #2D3748;">Rp ${total.toLocaleString('id-ID')}</div>
          </div>
        `;
      }).join('');
    }

    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoice.invoice_number}</title>
    <style>
        /* Reset & Base Styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #2D3748; 
            background: #F7FAFC;
            margin: 0; 
            padding: 0; 
        }
        
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid #E2E8F0;
        }
        
        .header img {
            max-height: 60px;
            margin-bottom: 20px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }
        
        .logo-fallback {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #311d6b, #4a2b7a);
            border-radius: 8px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }
        
        .header h1 {
            font-size: 24px;
            font-weight: 700;
            color: #2D3748;
            margin-bottom: 8px;
        }
        
        .header .subtitle {
            font-size: 16px;
            color: #718096;
            font-weight: 500;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section h3 {
            font-size: 16px;
            font-weight: 700;
            color: #2D3748;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .customer-details {
            background: #F7FAFC;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #E2E8F0;
        }
        
        .customer-details p {
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .customer-details strong {
            font-weight: 600;
            color: #2D3748;
        }
        
        .invoice-summary {
            background: #F7FAFC;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #E2E8F0;
        }
        
        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #E2E8F0;
        }
        
        .summary-row:last-child {
            border-bottom: none;
            font-weight: 700;
            font-size: 16px;
            padding-top: 16px;
            margin-top: 12px;
            border-top: 2px solid #48BB78;
        }
        
        .bank-info {
            background: #EDF2F7;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #4299E1;
        }
        
        .bank-info h4 {
            font-size: 14px;
            font-weight: 700;
            color: #2D3748;
            margin-bottom: 12px;
            text-transform: uppercase;
        }
        
        .bank-info p {
            margin-bottom: 6px;
            font-size: 14px;
        }
        
        .cta-section {
            text-align: center;
            margin: 40px 0;
        }
        
        .cta-primary {
            display: inline-block;
            background: linear-gradient(135deg, #311d6b 0%, #4a2b7a 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #E2E8F0;
            text-align: center;
            color: #718096;
            font-size: 14px;
        }
        
        .footer h4 {
            color: #2D3748;
            font-size: 16px;
            margin-bottom: 12px;
        }
        
        .footer p {
            margin-bottom: 4px;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container { 
                padding: 20px; 
                margin: 10px;
            }
            .summary-row {
                flex-direction: column;
                gap: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            ${businessLogo ? 
                `<img src="${businessLogo}" alt="${businessName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                 <div class="logo-fallback" style="display: none;">
                    ${businessName.charAt(0).toUpperCase()}
                 </div>` : 
                `<div class="logo-fallback">
                    ${businessName.charAt(0).toUpperCase()}
                 </div>`
            }
            <h1>Invoice Baru</h1>
            <p class="subtitle">Dari ${businessName}</p>
        </div>
        
        <div class="section">
            <h3>Kepada</h3>
            <div class="customer-details">
                <p><strong>Nama:</strong> ${invoice.customer_name}</p>
                <p><strong>Telepon:</strong> ${invoice.customer_phone || 'Tidak tersedia'}</p>
                <p><strong>Alamat:</strong> ${invoice.customer_address || 'Tidak tersedia'}</p>
            </div>
        </div>
        
        ${items.length > 0 ? `
        <div class="section">
            <h3>Detail Pembelian</h3>
            <div style="background: #F7FAFC; padding: 20px; border-radius: 8px; border: 1px solid #E2E8F0;">
                ${itemsList}
            </div>
        </div>
        ` : ''}
        
        <div class="section">
            <h3>Ringkasan Biaya</h3>
            <div class="invoice-summary">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>Rp ${(invoice.subtotal || invoice.grand_total).toLocaleString('id-ID')}</span>
                </div>
                ${invoice.discount > 0 ? `
                <div class="summary-row">
                    <span>Diskon:</span>
                    <span>-Rp ${invoice.discount.toLocaleString('id-ID')}</span>
                </div>
                ` : ''}
                ${invoice.shipping_cost > 0 ? `
                <div class="summary-row">
                    <span>Ongkos Kirim:</span>
                    <span>Rp ${invoice.shipping_cost.toLocaleString('id-ID')}</span>
                </div>
                ` : ''}
                <div class="summary-row">
                    <span>TOTAL:</span>
                    <span>Rp ${invoice.grand_total.toLocaleString('id-ID')}</span>
                </div>
                
                ${paymentSchedule && paymentSchedule.scheduleType === 'down_payment' ? `
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
                    <h4 style="margin-bottom: 12px; color: #2D3748;">Jadwal Pembayaran</h4>
                    <div class="summary-row" style="border-bottom: none; padding: 4px 0;">
                        <span>DP (${paymentSchedule.downPayment.percentage}%):</span>
                        <span>Rp ${paymentSchedule.downPayment.amount.toLocaleString('id-ID')}</span>
                    </div>
                    <div class="summary-row" style="border-bottom: none; padding: 4px 0;">
                        <span>Jatuh Tempo DP:</span>
                        <span>${paymentSchedule.downPayment.dueDate ? new Date(paymentSchedule.downPayment.dueDate).toLocaleDateString('id-ID') : 'Segera'}</span>
                    </div>
                    <div class="summary-row" style="border-bottom: none; padding: 4px 0;">
                        <span>Pelunasan:</span>
                        <span>Rp ${paymentSchedule.remainingBalance.amount.toLocaleString('id-ID')}</span>
                    </div>
                    <div class="summary-row" style="border-bottom: none; padding: 4px 0;">
                        <span>Jatuh Tempo Final:</span>
                        <span>${paymentSchedule.remainingBalance.dueDate ? new Date(paymentSchedule.remainingBalance.dueDate).toLocaleDateString('id-ID') : (new Date(invoice.due_date).toLocaleDateString('id-ID'))}</span>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="section">
            <h3>Informasi Pembayaran Bank Transfer</h3>
            <div class="bank-info">
                <h4>Bank Transfer</h4>
                <p><strong>Bank:</strong> BCA</p>
                <p><strong>No. Rekening:</strong> 4800273949</p>
                <p><strong>Atas Nama:</strong> Fairtel Mong</p>
            </div>
        </div>
        
        <div class="cta-section">
            <a href="${invoiceUrl}" class="cta-primary">Lihat Invoice Lengkap</a>
            <p style="margin-top: 16px; font-size: 14px; color: #718096;">
                Klik tombol di atas untuk melihat invoice lengkap dan upload bukti pembayaran.
            </p>
        </div>
        
        <div class="footer">
            <h4>Bevelient</h4>
            <p>Jl Duta Harapan Indah Blok KK no 29</p>
            <p>Telepon: 08979205209</p>
            <p>Email: Bevelient@gmail.com</p>
            <p>Website: https://bevelient.com</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateFinalPaymentEmailHTML(invoice, finalPaymentUrl, businessSettings = null) {
    const formattedFinalAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(invoice.final_payment_amount);

    const formattedTotalAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency', 
      currency: 'IDR'
    }).format(invoice.grand_total);

    // Use business settings if available, otherwise fall back to invoice/env data
    const businessName = businessSettings?.name || invoice.merchant_name || process.env.MERCHANT_NAME || 'Your Business';
    const businessAddress = businessSettings?.address || invoice.merchant_address || process.env.MERCHANT_ADDRESS || '';
    const businessPhone = businessSettings?.phone || invoice.merchant_phone || process.env.MERCHANT_PHONE || '';
    const businessEmail = businessSettings?.email || invoice.merchant_email || process.env.MERCHANT_EMAIL || '';
    const businessWebsite = businessSettings?.website || process.env.MERCHANT_WEBSITE || '';
    
    // Construct absolute logo URL for email clients
    const baseUrl = config.server.baseUrl;
    let businessLogo = null;
    const logoPath = businessSettings?.logo;
    console.log('📧 ===== FINAL PAYMENT EMAIL LOGO DEBUG =====');
    console.log('📧 baseUrl used:', baseUrl);
    console.log('📧 businessSettings:', businessSettings ? {
      name: businessSettings.name,
      logo: businessSettings.logo,
      logoUrl: businessSettings.logoUrl
    } : 'null');
    console.log('📧 logoPath extracted:', logoPath);
    
    if (logoPath) {
      // If logo is already absolute URL or data URL, use as is
      if (logoPath.startsWith('http') || logoPath.startsWith('data:')) {
        businessLogo = logoPath;
        console.log('📧 ✅ Using absolute/data URL as-is:', businessLogo);
      } else {
        // Convert relative path to absolute URL
        const cleanPath = logoPath.replace(/^\//, '');
        businessLogo = `${baseUrl}/${cleanPath}`;
        console.log('📧 ✅ Converted relative to absolute:', {
          original: logoPath,
          cleaned: cleanPath,
          final: businessLogo
        });
      }
    } else {
      // Default to Aspree logo if no business logo is provided
      businessLogo = `${baseUrl}/aspree2-logo.png?v=2`;
      console.log('📧 ⚠️ Using default Aspree logo (no business logo provided):', businessLogo);
    }
    
    // Validate the constructed URL
    try {
      new URL(businessLogo);
      console.log('📧 ✅ Logo URL is valid:', businessLogo);
    } catch (error) {
      console.error('📧 ❌ Invalid logo URL constructed:', businessLogo, error.message);
      // Fallback to default logo with base URL
      businessLogo = `${baseUrl}/aspree2-logo.png?v=2`;
      console.log('📧 🔧 Fallback to default logo:', businessLogo);
    }
    
    console.log('📧 ===== FINAL LOGO URL (PAYMENT) =====', businessLogo);
    console.log('📧 =======================================');

    // Get down payment amount from payment schedule
    let downPaymentAmount = 0;
    try {
      const paymentSchedule = typeof invoice.payment_schedule_json === 'string' 
        ? JSON.parse(invoice.payment_schedule_json) 
        : invoice.payment_schedule_json;
      if (paymentSchedule && paymentSchedule.downPayment) {
        downPaymentAmount = paymentSchedule.downPayment.amount;
      }
    } catch (e) {
      console.error('Error parsing payment schedule:', e);
    }

    const formattedDownPayment = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(downPaymentAmount);

    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pembayaran Akhir - Invoice ${invoice.invoice_number}</title>
    <style>
        /* Reset & Base Styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #2D3748; 
            background: #F7FAFC;
            margin: 0; 
            padding: 0; 
        }
        
        /* Container & Layout */
        .email-container { 
            max-width: 640px; 
            margin: 0 auto; 
            background: #F7FAFC;
            padding: 20px 0;
        }
        
        /* Header with Gradient */
        .header-brand {
            background: linear-gradient(135deg, #311d6b 0%, #4a2b7a 100%);
            padding: 12px 0;
            text-align: center;
            border-radius: 0;
        }
        .header-brand p {
            color: white;
            font-size: 14px;
            font-weight: 600;
            margin: 0;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* Main Header */
        .header {
            background: white;
            padding: 40px 32px;
            text-align: center;
            border-radius: 12px 12px 0 0;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            margin: 0 20px;
        }
        
        .header img {
            max-height: 80px;
            max-width: 250px;
            margin-bottom: 20px;
            border-radius: 8px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }
        
        .payment-logo-fallback {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #311d6b, #4a2b7a);
            border-radius: 12px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 32px;
            font-weight: bold;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 800;
            color: #2D3748;
            margin-bottom: 8px;
            line-height: 1.2;
        }
        
        .header .subtitle {
            font-size: 16px;
            color: #718096;
            font-weight: 500;
        }
        
        /* Content Cards */
        .content {
            background: white;
            margin: 0 20px;
            padding: 0;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        
        .welcome-section {
            padding: 32px;
            border-bottom: 1px solid #E2E8F0;
        }
        
        .welcome-section h2 {
            font-size: 20px;
            font-weight: 700;
            color: #2D3748;
            margin-bottom: 12px;
        }
        
        .welcome-section p {
            font-size: 16px;
            color: #4A5568;
            margin-bottom: 12px;
        }
        
        /* Payment Summary Card */
        .payment-card {
            background: linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%);
            border: 2px solid #E2E8F0;
            border-radius: 12px;
            padding: 24px;
            margin: 32px;
        }
        
        .payment-card h3 {
            font-size: 16px;
            font-weight: 700;
            color: #2D3748;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .payment-summary {
            display: grid;
            gap: 16px;
            margin-bottom: 20px;
        }
        
        .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #E2E8F0;
        }
        
        .summary-label {
            font-size: 14px;
            color: #718096;
            font-weight: 600;
        }
        
        .summary-value {
            font-size: 15px;
            font-weight: 600;
            color: #2D3748;
        }
        
        .final-amount-highlight {
            background: white;
            border: 3px solid #ED8936;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin-top: 16px;
        }
        
        .final-amount-highlight .label {
            font-size: 16px;
            color: #4A5568;
            margin-bottom: 8px;
            font-weight: 600;
        }
        
        .final-amount-highlight .amount {
            font-size: 36px;
            font-weight: 800;
            color: #ED8936;
            line-height: 1;
        }
        
        /* Payment Instructions */
        .instructions-section {
            padding: 32px;
            background: #FFF5F5;
            border-left: 4px solid #ED8936;
            margin: 32px;
            border-radius: 0 8px 8px 0;
        }
        
        .instructions-section h3 {
            color: #ED8936;
            margin-bottom: 16px;
            font-size: 18px;
            font-weight: 700;
        }
        
        .instructions-section p {
            margin-bottom: 12px;
            line-height: 1.7;
            color: #2D3748;
        }
        
        .instructions-section strong {
            color: #ED8936;
        }
        
        /* Call to Action */
        .cta-section {
            padding: 32px;
            text-align: center;
            background: white;
        }
        
        .cta-primary {
            display: inline-block;
            background: linear-gradient(135deg, #ED8936 0%, #DD6B20 100%);
            color: white;
            padding: 20px 40px;
            text-decoration: none;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 700;
            margin: 16px 0;
            box-shadow: 0 4px 15px rgba(237, 137, 54, 0.3);
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .cta-description {
            font-size: 14px;
            color: #718096;
            margin-top: 16px;
            line-height: 1.6;
        }
        
        /* Security & Trust */
        .trust-section {
            padding: 24px 32px;
            background: #F7FAFC;
            text-align: center;
            border-bottom: 1px solid #E2E8F0;
        }
        
        .trust-badges {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 16px;
            margin-bottom: 12px;
        }
        
        .trust-badge {
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 600;
            color: #4A5568;
        }
        
        .trust-text {
            font-size: 12px;
            color: #718096;
            margin: 0;
        }
        
        /* Footer */
        .footer {
            background: linear-gradient(135deg, #311d6b 0%, #4a2b7a 100%);
            color: white;
            padding: 32px;
            text-align: center;
            border-radius: 0 0 12px 12px;
            margin: 0 20px;
        }
        
        .footer-business {
            margin-bottom: 20px;
        }
        
        .footer-business h4 {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
        }
        
        .footer-contact {
            font-size: 14px;
            opacity: 0.9;
            line-height: 1.6;
        }
        
        .footer-brand {
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            font-size: 12px;
            opacity: 0.7;
        }
        
        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            .email-container { padding: 10px 0; }
            .header, .content, .footer { margin: 0 10px; }
            .header { padding: 24px 20px; }
            .payment-card, .welcome-section, .instructions-section, .cta-section, .trust-section { padding: 20px; }
            .payment-card { margin: 20px; }
            .instructions-section { margin: 20px; }
            .final-amount-highlight .amount { font-size: 28px; }
            .trust-badges { flex-wrap: wrap; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Brand Header -->
        <div class="header-brand">
            <p>Generated with Aspree Invoice Generator</p>
        </div>
        
        <!-- Main Header -->
        <div class="header">
            ${businessLogo ? 
                `<img src="${businessLogo}" alt="${businessName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                 <div class="payment-logo-fallback" style="display: none;">
                    ${businessName.charAt(0).toUpperCase()}
                 </div>` : 
                `<div class="payment-logo-fallback">
                    ${businessName.charAt(0).toUpperCase()}
                 </div>`
            }
            <h1>🏦 Pembayaran Akhir Diperlukan</h1>
            <p class="subtitle">Dari ${businessName}</p>
        </div>
        
        <div class="content">
            <!-- Welcome Section -->
            <div class="welcome-section">
                <h2>Halo ${invoice.customer_name},</h2>
                <p>Terima kasih atas pembayaran uang muka Anda. Sekarang saatnya untuk menyelesaikan pembayaran akhir invoice Anda.</p>
                <p><strong>Invoice:</strong> ${invoice.invoice_number}</p>
            </div>
            
            <!-- Payment Summary Card -->
            <div class="payment-card">
                <h3>💰 Ringkasan Pembayaran</h3>
                <div class="payment-summary">
                    <div class="summary-row">
                        <span class="summary-label">Total Invoice:</span>
                        <span class="summary-value">${formattedTotalAmount}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">Uang Muka Sudah Dibayar:</span>
                        <span class="summary-value">${formattedDownPayment}</span>
                    </div>
                </div>
                
                <div class="final-amount-highlight">
                    <div class="label">💳 Sisa Pembayaran</div>
                    <div class="amount">${formattedFinalAmount}</div>
                </div>
            </div>
            
            <!-- Payment Instructions -->
            <div class="instructions-section">
                <h3>📋 Cara Menyelesaikan Pembayaran</h3>
                <p><strong>1. Klik tombol "Bayar Sekarang" di bawah ini</strong></p>
                <p><strong>2. Pilih metode pembayaran yang diinginkan</strong></p>
                <p><strong>3. Ikuti instruksi pembayaran di halaman selanjutnya</strong></p>
                <p><strong>4. Upload bukti pembayaran jika diperlukan</strong></p>
                <p style="margin-top: 20px; padding: 16px; background: rgba(237, 137, 54, 0.1); border-radius: 8px; border-left: 4px solid #ED8936;">
                    <strong>⏰ Penting:</strong> Harap selesaikan pembayaran sesegera mungkin untuk memastikan pesanan Anda dapat diproses tepat waktu.
                </p>
            </div>
            
            <!-- Call to Action -->
            <div class="cta-section">
                <a href="${finalPaymentUrl}" class="cta-primary">💳 Bayar Sekarang</a>
                <p class="cta-description">
                    Klik tombol di atas untuk mengakses halaman pembayaran yang aman dan menyelesaikan pembayaran akhir Anda.
                </p>
            </div>
            
            <!-- Trust & Security -->
            <div class="trust-section">
                <div class="trust-badges">
                    <div class="trust-badge">🔒 SSL Secure</div>
                    <div class="trust-badge">🛡️ Protected</div>
                    <div class="trust-badge">✅ Verified</div>
                </div>
                <p class="trust-text">Pembayaran Anda aman dan terlindungi dengan enkripsi tingkat bank</p>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-business">
                <h4>${businessName}</h4>
                <div class="footer-contact">
                    ${businessAddress ? `📍 ${businessAddress}<br>` : ''}
                    ${businessPhone ? `📞 ${businessPhone}<br>` : ''}
                    ${businessEmail ? `📧 ${businessEmail}<br>` : ''}
                    ${businessWebsite ? `🌐 ${businessWebsite}` : ''}
                </div>
            </div>
            <div class="footer-brand">
                <p>Powered by Aspree Invoice Generator</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  // Password reset email
  async sendPasswordResetEmail(merchantEmail, resetToken, businessName = 'AI Invoice Generator') {
    if (!this.isConfigured) {
      return this.sendMockPasswordResetEmail(merchantEmail, resetToken, businessName);
    }

    try {
      const resetUrl = `${config.server.baseUrl}/auth/reset-password?token=${resetToken}`;
      
      const htmlContent = this.generatePasswordResetEmailHTML(merchantEmail, resetUrl, businessName);

      const mailOptions = {
        from: `"${businessName}" <${this.config.user}>`,
        to: merchantEmail,
        subject: `🔐 Password Reset Request - ${businessName}`,
        html: htmlContent,
        headers: {
          'X-Mailer': 'AI Invoice Generator',
          'X-Priority': '1'
        }
      };

      console.log(`📧 Sending password reset email to ${merchantEmail}...`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent successfully: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        resetUrl: resetUrl // Remove in production
      };
    } catch (error) {
      console.error('❌ Password reset email failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendMockPasswordResetEmail(merchantEmail, resetToken, businessName) {
    const resetUrl = `${config.server.baseUrl}/auth/reset-password?token=${resetToken}`;
    
    console.log('\n📧 ========== MOCK PASSWORD RESET EMAIL ==========');
    console.log(`📧 Type: Password Reset`);
    console.log(`📧 To: ${merchantEmail}`);
    console.log(`📧 From: "${businessName}" <${this.config.user || 'not-configured@example.com'}>`);
    console.log(`📧 Subject: 🔐 Password Reset Request - ${businessName}`);
    console.log(`📧 Reset URL: ${resetUrl}`);
    console.log('📧 Content: Password reset instructions with reset link');
    console.log('📧 ===============================================\n');
    
    return {
      success: true,
      mock: true,
      resetUrl: resetUrl
    };
  }

  // Email verification email
  async sendEmailVerificationEmail(merchantEmail, verificationToken, businessName = 'AI Invoice Generator') {
    if (!this.isConfigured) {
      return this.sendMockEmailVerificationEmail(merchantEmail, verificationToken, businessName);
    }

    try {
      const verificationUrl = `${config.server.baseUrl}/auth/verify-email?token=${verificationToken}`;
      
      const htmlContent = this.generateEmailVerificationHTML(merchantEmail, verificationUrl, businessName);

      const mailOptions = {
        from: `"${businessName}" <${this.config.user}>`,
        to: merchantEmail,
        subject: `✉️ Verify Your Email - ${businessName}`,
        html: htmlContent,
        headers: {
          'X-Mailer': 'AI Invoice Generator',
          'X-Priority': '1'
        }
      };

      console.log(`📧 Sending email verification to ${merchantEmail}...`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email verification sent successfully: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        verificationUrl: verificationUrl // Remove in production
      };
    } catch (error) {
      console.error('❌ Email verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendMockEmailVerificationEmail(merchantEmail, verificationToken, businessName) {
    const verificationUrl = `${config.server.baseUrl}/auth/verify-email?token=${verificationToken}`;
    
    console.log('\n📧 ======== MOCK EMAIL VERIFICATION EMAIL ========');
    console.log(`📧 Type: Email Verification`);
    console.log(`📧 To: ${merchantEmail}`);
    console.log(`📧 From: "${businessName}" <${this.config.user || 'not-configured@example.com'}>`);
    console.log(`📧 Subject: ✉️ Verify Your Email - ${businessName}`);
    console.log(`📧 Verification URL: ${verificationUrl}`);
    console.log('📧 Content: Email verification instructions with verification link');
    console.log('📧 ===============================================\n');
    
    return {
      success: true,
      mock: true,
      verificationUrl: verificationUrl
    };
  }

  generateEmailVerificationHTML(merchantEmail, verificationUrl, businessName) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - ${businessName}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f7fafc; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #8B5FFF 0%, #9966FF 100%); color: white; padding: 40px 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
            .content { padding: 40px 32px; }
            .verification-card { background: #f8f9ff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
            .verify-button { display: inline-block; background: #48BB78; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .verify-button:hover { background: #38a169; }
            .info-note { background: #e6fffa; border: 1px solid #4fd1c7; border-radius: 8px; padding: 16px; margin: 24px 0; }
            .footer { background: #f7fafc; padding: 24px 32px; text-align: center; color: #718096; font-size: 14px; }
            .token-info { font-family: monospace; background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 16px 0; word-break: break-all; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✉️ Verify Your Email</h1>
                <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Welcome to ${businessName}</p>
            </div>
            
            <div class="content">
                <h2 style="color: #2d3748; margin-bottom: 16px;">Welcome!</h2>
                <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                    Thank you for creating your merchant account with <strong>${businessName}</strong>. 
                    To complete your registration, please verify your email address: <strong>${merchantEmail}</strong>
                </p>
                
                <div class="verification-card">
                    <h3 style="color: #553c9a; margin-bottom: 12px;">🔗 Verify Your Email Address</h3>
                    <p style="color: #718096; margin-bottom: 20px;">
                        Click the button below to verify your email address and activate your account.
                    </p>
                    <a href="${verificationUrl}" class="verify-button">Verify Email Now</a>
                </div>
                
                <div class="info-note">
                    <h4 style="color: #285e61; margin-bottom: 8px;">📋 What happens after verification?</h4>
                    <ul style="color: #285e61; text-align: left; margin: 0; padding-left: 20px;">
                        <li>Your account will be fully activated</li>
                        <li>You can access all features of the platform</li>
                        <li>You'll receive important updates and notifications</li>
                        <li>Your account security will be enhanced</li>
                    </ul>
                </div>
                
                <p style="color: #718096; font-size: 14px; margin-top: 24px;">
                    If the button doesn't work, you can copy and paste this link into your browser:
                </p>
                <div class="token-info">
                    ${verificationUrl}
                </div>
            </div>
            
            <div class="footer">
                <p><strong>${businessName}</strong> - AI Invoice Generator</p>
                <p style="margin: 8px 0 0 0;">If you didn't create this account, please ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  generatePasswordResetEmailHTML(merchantEmail, resetUrl, businessName) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - ${businessName}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f7fafc; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #8B5FFF 0%, #9966FF 100%); color: white; padding: 40px 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
            .content { padding: 40px 32px; }
            .reset-card { background: #f8f9ff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
            .reset-button { display: inline-block; background: #8B5FFF; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .reset-button:hover { background: #7c3aed; }
            .security-note { background: #fef5e7; border: 1px solid #f6d55c; border-radius: 8px; padding: 16px; margin: 24px 0; }
            .footer { background: #f7fafc; padding: 24px 32px; text-align: center; color: #718096; font-size: 14px; }
            .token-info { font-family: monospace; background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 16px 0; word-break: break-all; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset Request</h1>
                <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Secure password reset for ${businessName}</p>
            </div>
            
            <div class="content">
                <h2 style="color: #2d3748; margin-bottom: 16px;">Hello,</h2>
                <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                    We received a request to reset the password for your merchant account associated with <strong>${merchantEmail}</strong>.
                </p>
                
                <div class="reset-card">
                    <h3 style="color: #553c9a; margin-bottom: 12px;">🔗 Reset Your Password</h3>
                    <p style="color: #718096; margin-bottom: 20px;">
                        Click the button below to reset your password. This link will expire in 1 hour for security reasons.
                    </p>
                    <a href="${resetUrl}" class="reset-button">Reset Password Now</a>
                </div>
                
                <div class="security-note">
                    <h4 style="color: #92400e; margin-bottom: 8px;">🛡️ Security Information</h4>
                    <ul style="color: #92400e; text-align: left; margin: 0; padding-left: 20px;">
                        <li>This link expires in 1 hour</li>
                        <li>Can only be used once</li>
                        <li>If you didn't request this reset, please ignore this email</li>
                        <li>Your current password remains unchanged until you complete the reset</li>
                    </ul>
                </div>
                
                <p style="color: #718096; font-size: 14px; margin-top: 24px;">
                    If the button doesn't work, you can copy and paste this link into your browser:
                </p>
                <div class="token-info">
                    ${resetUrl}
                </div>
            </div>
            
            <div class="footer">
                <p><strong>${businessName}</strong> - AI Invoice Generator</p>
                <p style="margin: 8px 0 0 0;">This is an automated security email. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      host: this.config.host,
      user: this.config.user ? this.config.user.replace(/(.{3}).*(@.*)/, '$1***$2') : 'Not set',
      mockMode: !this.isConfigured
    };
  }
}

export default SimpleEmailService;
