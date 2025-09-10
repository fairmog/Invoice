import fetch from 'node-fetch';
import crypto from 'crypto';

class XenditService {
  constructor() {
    this.baseUrls = {
      sandbox: 'https://api.xendit.co',
      production: 'https://api.xendit.co'
    };
  }

  getBaseUrl(environment = 'sandbox') {
    return this.baseUrls[environment] || this.baseUrls.sandbox;
  }

  getAuthHeaders(secretKey) {
    const credentials = Buffer.from(`${secretKey}:`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    };
  }

  async createInvoice(secretKey, environment, invoiceData) {
    try {
      const url = `${this.getBaseUrl(environment)}/v2/invoices`;
      
      const payload = {
        external_id: invoiceData.externalId,
        amount: invoiceData.amount,
        description: invoiceData.description || 'Invoice Payment',
        invoice_duration: invoiceData.duration || 86400, // 24 hours in seconds
        customer: {
          given_names: invoiceData.customer?.name || 'Customer',
          email: invoiceData.customer?.email || '',
          mobile_number: invoiceData.customer?.phone || ''
        },
        customer_notification_preference: {
          invoice_created: ["email", "sms"],
          invoice_reminder: ["email", "sms"],
          invoice_paid: ["email", "sms"]
        },
        success_redirect_url: invoiceData.successUrl,
        failure_redirect_url: invoiceData.failureUrl,
        currency: invoiceData.currency || 'IDR',
        items: invoiceData.items || [],
        fees: invoiceData.fees || []
      };

      // Add payment methods if specified
      if (invoiceData.paymentMethods && invoiceData.paymentMethods.length > 0) {
        payload.payment_methods = invoiceData.paymentMethods;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(secretKey),
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Xendit createInvoice error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getInvoice(secretKey, environment, invoiceId) {
    try {
      const url = `${this.getBaseUrl(environment)}/v2/invoices/${invoiceId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(secretKey)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Xendit getInvoice error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async expireInvoice(secretKey, environment, invoiceId) {
    try {
      const url = `${this.getBaseUrl(environment)}/v2/invoices/${invoiceId}/expire`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(secretKey)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Xendit expireInvoice error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAvailablePaymentMethods(secretKey, environment, amount = 10000) {
    try {
      const url = `${this.getBaseUrl(environment)}/payment_methods`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(secretKey)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Xendit getPaymentMethods error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testConnection(secretKey, environment = 'sandbox') {
    try {
      // Create a test invoice to verify connection
      const testInvoiceData = {
        externalId: `test_${Date.now()}`,
        amount: 10000,
        description: 'Test Connection Invoice',
        duration: 300, // 5 minutes
        customer: {
          name: 'Test Customer',
          email: 'test@example.com'
        }
      };

      const result = await this.createInvoice(secretKey, environment, testInvoiceData);
      
      if (result.success) {
        // Immediately expire the test invoice to avoid clutter
        await this.expireInvoice(secretKey, environment, result.data.id);
        
        return {
          success: true,
          invoiceId: result.data.id,
          message: 'Connection successful'
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Xendit testConnection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  verifyWebhookSignature(rawBody, signature, webhookToken) {
    if (!webhookToken || !signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookToken)
        .update(rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  parseWebhookEvent(body) {
    try {
      const event = typeof body === 'string' ? JSON.parse(body) : body;
      
      return {
        id: event.id,
        event: event.event || 'invoice.paid', // Default event type
        externalId: event.external_id,
        status: event.status,
        amount: event.amount,
        paidAmount: event.paid_amount,
        currency: event.currency,
        paymentMethod: event.payment_method,
        paymentChannel: event.payment_channel,
        paidAt: event.paid_at,
        created: event.created,
        updated: event.updated,
        description: event.description,
        merchantName: event.merchant_name,
        raw: event
      };
    } catch (error) {
      console.error('Error parsing webhook event:', error);
      return null;
    }
  }

  getPaymentMethodsForInvoice(enabledMethods) {
    const availableMethods = [];

    if (enabledMethods.bankTransfer) {
      availableMethods.push('BANK_TRANSFER');
    }

    if (enabledMethods.ewallet) {
      availableMethods.push('EWALLET');
    }

    if (enabledMethods.retailOutlet) {
      availableMethods.push('RETAIL_OUTLET');
    }

    if (enabledMethods.creditCard) {
      availableMethods.push('CREDIT_CARD');
    }

    return availableMethods.length > 0 ? availableMethods : undefined;
  }

  formatInvoiceForDatabase(xenditInvoice) {
    return {
      xenditId: xenditInvoice.id,
      externalId: xenditInvoice.external_id,
      status: xenditInvoice.status,
      amount: xenditInvoice.amount,
      currency: xenditInvoice.currency,
      description: xenditInvoice.description,
      invoiceUrl: xenditInvoice.invoice_url,
      expiryDate: xenditInvoice.expiry_date,
      created: xenditInvoice.created,
      updated: xenditInvoice.updated
    };
  }

  getStatusMapping(xenditStatus) {
    const statusMap = {
      'PENDING': 'pending',
      'PAID': 'paid',
      'SETTLED': 'completed',
      'EXPIRED': 'expired',
      'FAILED': 'failed'
    };

    return statusMap[xenditStatus] || 'unknown';
  }
}

export default XenditService;