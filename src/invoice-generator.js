import OpenAIService from './openai-service.js';
import { IndonesianPrompts } from './indonesian-prompts.js';
import OptimizedPrompts from './optimized-prompts.js';
import InvoiceCalculations from '../utils/invoice-calculations.js';
import errorHandler from '../utils/error-handler.js';

class InvoiceGenerator {
  constructor(openaiService = null) {
    this.openai = openaiService || new OpenAIService();
    this.calculator = new InvoiceCalculations();
    this.maxRetries = 3;
  }

  async enrichCustomerData(orderData) {
    try {
      // Only enrich if we have customer email or phone to search for
      if (!orderData.customer?.email && !orderData.customer?.phone) {
        return;
      }

      const CustomerExtractionService = await import('./customer-extraction-service.js');
      const customerService = new CustomerExtractionService.default();
      
      const existingCustomer = await customerService.findExistingCustomer(
        orderData.customer.email,
        orderData.customer.phone
      );

      if (existingCustomer) {
        console.log(`👤 Found returning customer: ${existingCustomer.name}`);
        
        // Merge existing customer data with provided data, preferring provided data
        orderData.customer = {
          name: orderData.customer.name || existingCustomer.name,
          email: orderData.customer.email || existingCustomer.email,
          phone: orderData.customer.phone || existingCustomer.phone,
          address: orderData.customer.address || existingCustomer.address,
          // Add metadata for tracking
          isReturningCustomer: true,
          customerId: existingCustomer.id,
          previousInvoiceCount: existingCustomer.invoice_count || 0,
          totalSpent: existingCustomer.total_spent || 0
        };
        
        console.log(`✅ Customer data enriched for returning customer (${existingCustomer.invoice_count || 0} previous invoices)`);
      }
    } catch (error) {
      console.error('Error enriching customer data:', error);
      // Don't fail invoice generation if customer enrichment fails
    }
  }

  async generateInvoice(orderData, merchantConfig, shippingOptions = null, additionalNotes = null, paymentOptions = {}) {
    return await errorHandler.withRetry(async () => {
      try {
        // Auto-populate customer data from existing customers
        await this.enrichCustomerData(orderData);
        
        // Validate input data first
        this.validateOrderData(orderData);
        this.validateMerchantConfig(merchantConfig);
        
        console.log('⚡ Using optimized prompts for faster processing...');
        
        // DEBUG: Log payment options being passed to invoice generation
        console.log('🔍 Payment options passed to generateInvoice:', JSON.stringify(paymentOptions, null, 2));
        if (paymentOptions.enablePaymentSchedule) {
          console.log('✅ Payment schedule included in generated invoice');
          console.log('🔍 Payment schedule details:', {
            downPaymentPercentage: paymentOptions.downPaymentPercentage,
            downPaymentDays: paymentOptions.downPaymentDays,
            finalPaymentDays: paymentOptions.finalPaymentDays
          });
        }
        
        const prompt = OptimizedPrompts.generateInvoice(orderData, merchantConfig, paymentOptions);

        const response = await this.openai.createChatCompletion({
          messages: [
            {
              role: "system",
              content: "Create invoice JSON. Return only valid JSON, no markdown or text. Use computed numbers, not formulas."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: this.openai.getTokenLimit('invoice')
        });

        if (!response.success) {
          throw errorHandler.createError(
            errorHandler.errorTypes.AI_SERVICE_ERROR,
            `Invoice generation failed: ${response.error}`,
            { orderData: { customerName: orderData.customer?.name, itemCount: orderData.items?.length } }
          );
        }

        console.log('🤖 AI Invoice Response (first 500 chars):', response.content.substring(0, 500) + '...');
        const parseResult = this.openai.parseJSONResponse(response.content, true);
        
        if (!parseResult.success) {
          throw errorHandler.createError(
            errorHandler.errorTypes.AI_SERVICE_ERROR,
            `JSON parsing failed: ${parseResult.error}`,
            { responseContent: response.content.substring(0, 200) }
          );
        }
        
        // DEBUG: Log if payment schedule was generated in invoice
        if (parseResult.data.invoice?.paymentSchedule) {
          console.log('✅ Payment schedule included in generated invoice');
          console.log('🔍 Payment schedule details:', JSON.stringify(parseResult.data.invoice.paymentSchedule, null, 2));
        } else {
          console.log('❌ No payment schedule found in generated invoice');
          console.log('🔍 Payment options received:', JSON.stringify(paymentOptions, null, 2));
        }
        
        // Validate and recalculate the generated invoice
        const validatedInvoice = await this.validateAndRecalculateInvoice(parseResult.data);
        return validatedInvoice;
        
      } catch (error) {
        errorHandler.logError(error, { operation: 'generateInvoice', customerName: orderData.customer?.name });
        throw error;
      }
    }, this.maxRetries, 1000, { operation: 'generateInvoice' });
  }

  async validateInvoice(invoiceData) {
    return await errorHandler.withRetry(async () => {
      try {
        // First, do local calculation validation
        const calculationResult = this.calculator.recalculateInvoice(invoiceData);
        
        if (!calculationResult.success) {
          throw errorHandler.createError(
            errorHandler.errorTypes.CALCULATION_ERROR,
            calculationResult.error,
            { invoiceNumber: invoiceData.invoice?.header?.invoiceNumber }
          );
        }

        const prompt = OptimizedPrompts.validateInvoice(invoiceData);

        const response = await this.openai.createChatCompletion({
          messages: [
            {
              role: "system",
              content: "Validate invoice JSON. Return only valid JSON validation result."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: this.openai.getTokenLimit('validation')
        });

        if (!response.success) {
          throw errorHandler.createError(
            errorHandler.errorTypes.AI_SERVICE_ERROR,
            `Invoice validation failed: ${response.error}`,
            { invoiceNumber: invoiceData.invoice?.header?.invoiceNumber }
          );
        }

        console.log('🤖 AI Validation Response:', response.content.substring(0, 500) + '...');
        const parseResult = this.openai.parseJSONResponse(response.content, true);
        
        if (!parseResult.success) {
          throw errorHandler.createError(
            errorHandler.errorTypes.AI_SERVICE_ERROR,
            `Validation JSON parsing failed: ${parseResult.error}`,
            { responseContent: response.content.substring(0, 200) }
          );
        }
        
        // Combine AI validation with calculation validation
        const combinedValidation = {
          ...parseResult.data,
          calculationValidation: calculationResult,
          isCalculationAccurate: calculationResult.isAccurate,
          calculationWarnings: calculationResult.difference > 0.01 ? 
            [`Calculation difference detected: ${calculationResult.difference.toFixed(2)}`] : []
        };
        
        return combinedValidation;
        
      } catch (error) {
        errorHandler.logError(error, { operation: 'validateInvoice', invoiceNumber: invoiceData.invoice?.header?.invoiceNumber });
        throw error;
      }
    }, this.maxRetries, 1000, { operation: 'validateInvoice' });
  }

  async customizeInvoiceTemplate(invoiceData, templatePreferences) {
    const prompt = `Customize this invoice based on template preferences:

Invoice Data:
${JSON.stringify(invoiceData, null, 2)}

Template Preferences:
${JSON.stringify(templatePreferences, null, 2)}

Customize the invoice with:
1. Brand colors and styling
2. Logo placement and sizing
3. Layout preferences
4. Custom fields
5. Language localization
6. Currency formatting
7. Date formats
8. Custom messaging

Return the customized invoice with additional template metadata:
{
  "customizedInvoice": {original invoice structure with customizations},
  "templateData": {
    "theme": "template theme name",
    "colors": {
      "primary": "hex color",
      "secondary": "hex color",
      "accent": "hex color"
    },
    "layout": {
      "headerStyle": "style configuration",
      "itemsTableStyle": "table styling",
      "footerStyle": "footer styling"
    },
    "customFields": [
      {
        "fieldName": "custom field name",
        "fieldValue": "custom field value",
        "placement": "header|body|footer"
      }
    ],
    "localization": {
      "language": "language code",
      "currency": "currency code",
      "dateFormat": "date format string",
      "numberFormat": "number format string"
    }
  }
}

Rules:
- Apply brand colors consistently
- Ensure readability and professionalism
- Handle multiple languages if specified
- Format currency according to locale
- Maintain legal compliance
- Optimize for both print and digital viewing`;

    const response = await this.openai.createChatCompletion({
      messages: [
        {
          role: "system",
          content: "You are an invoice customization assistant. Customize invoice templates and return valid JSON only. Return ONLY valid JSON. Do not include markdown, comments, or any text outside the JSON object. All values must be valid JSON types. Do not use expressions or formulas—use only numbers, strings, arrays, or objects. For numbers, always provide the computed value, not a formula."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.openai.getTokenLimit('customization')
    });

    if (!response.success) {
      throw new Error(`Invoice template customization failed: ${response.error}`);
    }

    const parseResult = this.openai.parseJSONResponse(response.content, true);
    
    if (!parseResult.success) {
      throw new Error(`JSON parsing failed: ${parseResult.error}`);
    }
    
    return parseResult.data;
  }




  // Input validation methods
  validateOrderData(orderData) {
    if (!orderData) {
      throw errorHandler.createError(
        errorHandler.errorTypes.VALIDATION_ERROR,
        'Order data is required'
      );
    }

    // Validate customer data
    if (!orderData.customer) {
      throw errorHandler.createError(
        errorHandler.errorTypes.VALIDATION_ERROR,
        'Customer information is required'
      );
    }

    if (!orderData.customer.name || orderData.customer.name.trim().length === 0) {
      throw errorHandler.createError(
        errorHandler.errorTypes.VALIDATION_ERROR,
        'Customer name is required'
      );
    }

    // Validate items array
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw errorHandler.createError(
        errorHandler.errorTypes.VALIDATION_ERROR,
        'At least one item is required'
      );
    }

    // Validate each item
    orderData.items.forEach((item, index) => {
      if (!item.productName || item.productName.trim().length === 0) {
        throw errorHandler.createError(
          errorHandler.errorTypes.VALIDATION_ERROR,
          `Item ${index + 1}: Product name is required`
        );
      }

      if (!item.quantity || item.quantity <= 0) {
        throw errorHandler.createError(
          errorHandler.errorTypes.VALIDATION_ERROR,
          `Item ${index + 1}: Valid quantity is required`
        );
      }

      if (item.unitPrice === undefined || item.unitPrice < 0) {
        throw errorHandler.createError(
          errorHandler.errorTypes.VALIDATION_ERROR,
          `Item ${index + 1}: Valid unit price is required`
        );
      }
    });
  }

  validateMerchantConfig(merchantConfig) {
    if (!merchantConfig) {
      throw errorHandler.createError(
        errorHandler.errorTypes.VALIDATION_ERROR,
        'Merchant configuration is required'
      );
    }

    if (!merchantConfig.businessName && !merchantConfig.name) {
      throw errorHandler.createError(
        errorHandler.errorTypes.VALIDATION_ERROR,
        'Business name is required in merchant configuration'
      );
    }
  }

  // Validate and recalculate invoice data
  async validateAndRecalculateInvoice(invoiceData) {
    try {
      if (!invoiceData || !invoiceData.invoice) {
        throw errorHandler.createError(
          errorHandler.errorTypes.VALIDATION_ERROR,
          'Invalid invoice data structure'
        );
      }

      const invoice = invoiceData.invoice;
      const items = invoice.items || [];

      if (items.length === 0) {
        throw errorHandler.createError(
          errorHandler.errorTypes.VALIDATION_ERROR,
          'Invoice must contain at least one item'
        );
      }

      // Recalculate using our calculation utility
      const taxEnabled = invoice.calculations?.taxEnabled || false;
      const taxRate = invoice.calculations?.taxRate || 0;
      
      // Handle discount based on type
      let discountOptions = {};
      const discountValue = invoice.calculations?.discount || 0;
      const discountType = invoice.calculations?.discountType || 'fixed';
      
      if (discountValue > 0) {
        if (discountType === 'percentage') {
          // If discountValue > 100, it's likely already calculated, use as fixed amount
          if (discountValue > 100) {
            discountOptions.discountAmount = discountValue;
          } else {
            discountOptions.discountRate = discountValue;
          }
        } else {
          discountOptions.discountAmount = discountValue;
        }
      }
      
      const calculationResult = this.calculator.calculateInvoiceTotal(items, {
        taxEnabled: taxEnabled,
        taxRate: taxRate,
        shippingCost: invoice.calculations?.shippingCost || 0,
        ...discountOptions
      });

      if (!calculationResult.success) {
        throw errorHandler.createError(
          errorHandler.errorTypes.CALCULATION_ERROR,
          calculationResult.error
        );
      }

      // Update invoice with recalculated values
      invoiceData.invoice.calculations = {
        ...invoiceData.invoice.calculations,
        ...calculationResult.calculations
      };

      // PAYMENT SCHEDULE VALIDATION & COMPLETION
      // Ensure payment schedule is complete if it exists
      if (invoiceData.invoice.paymentSchedule) {
        const paymentSchedule = invoiceData.invoice.paymentSchedule;
        console.log('🔧 Validating payment schedule completeness:', JSON.stringify(paymentSchedule, null, 2));
        
        // Check if payment schedule is properly structured
        if (paymentSchedule.scheduleType === 'down_payment') {
          let needsRegeneration = false;
          
          // Validate downPayment object
          if (!paymentSchedule.downPayment || 
              typeof paymentSchedule.downPayment.amount !== 'number' ||
              typeof paymentSchedule.downPayment.percentage !== 'number' ||
              !paymentSchedule.downPayment.dueDate) {
            console.log('❌ Incomplete downPayment object detected');
            needsRegeneration = true;
          }
          
          // Validate remainingBalance object
          if (!paymentSchedule.remainingBalance || 
              typeof paymentSchedule.remainingBalance.amount !== 'number' ||
              !paymentSchedule.remainingBalance.dueDate) {
            console.log('❌ Incomplete remainingBalance object detected');
            needsRegeneration = true;
          }
          
          // Regenerate payment schedule if incomplete
          if (needsRegeneration) {
            console.log('🔧 Regenerating complete payment schedule...');
            
            const grandTotal = calculationResult.calculations.grandTotal;
            const percentage = paymentSchedule.downPayment?.percentage || 25; // Default to 25%
            const downPaymentAmount = Math.round(grandTotal * (percentage / 100));
            const remainingAmount = grandTotal - downPaymentAmount;
            
            const today = new Date().toISOString().split('T')[0];
            const downPaymentDueDate = paymentSchedule.downPayment?.dueDate || today;
            
            // Calculate final payment due date (30 days from invoice date by default)
            const finalPaymentDueDate = paymentSchedule.remainingBalance?.dueDate || 
              new Date(new Date(today).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            // Complete payment schedule object
            invoiceData.invoice.paymentSchedule = {
              scheduleType: 'down_payment',
              totalAmount: grandTotal,
              downPayment: {
                percentage: percentage,
                amount: downPaymentAmount,
                dueDate: downPaymentDueDate,
                status: 'pending'
              },
              remainingBalance: {
                amount: remainingAmount,
                dueDate: finalPaymentDueDate,
                status: 'pending'
              },
              paymentStatus: {
                status: 'pending',
                totalPaid: 0,
                remainingAmount: grandTotal,
                lastPaymentDate: null,
                paymentHistory: []
              }
            };
            
            console.log('✅ Payment schedule regenerated successfully:', JSON.stringify(invoiceData.invoice.paymentSchedule, null, 2));
          } else {
            console.log('✅ Payment schedule is already complete');
          }
        }
      }

      // Add validation metadata
      invoiceData.validation = calculationResult.validation;
      invoiceData.recalculated = true;
      invoiceData.recalculatedAt = new Date().toISOString();

      return invoiceData;

    } catch (error) {
      errorHandler.logError(error, { operation: 'validateAndRecalculateInvoice' });
      throw error;
    }
  }

  generateInvoiceNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const timestamp = now.getTime().toString().slice(-6);
    const random4 = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    return `INV-${year}-${timestamp}-${random4}`;
  }

  calculateDueDate(invoiceDate, paymentTerms = "NET_30") {
    const date = new Date(invoiceDate);
    const daysToAdd = {
      "NET_15": 15,
      "NET_30": 30,
      "NET_45": 45,
      "NET_60": 60,
      "DUE_ON_RECEIPT": 0
    }[paymentTerms] || 30;
    
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  }
}

export default InvoiceGenerator;