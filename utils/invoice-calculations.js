// Centralized invoice calculation utility with validation
// Ensures accuracy and consistency across all invoice operations

class InvoiceCalculations {
  constructor() {
    this.defaultTaxRate = 0; // Tax is now optional - 0% by default
    this.defaultCurrency = 'IDR';
    this.precision = 2; // Decimal places for calculations
  }

  // Validate numerical input
  validateNumber(value, fieldName = 'value', allowZero = true) {
    if (value === null || value === undefined) {
      throw new Error(`${fieldName} cannot be null or undefined`);
    }
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    
    if (!allowZero && num <= 0) {
      throw new Error(`${fieldName} must be greater than 0`);
    }
    
    if (num < 0) {
      throw new Error(`${fieldName} cannot be negative`);
    }
    
    return num;
  }

  // Calculate line total for a single item
  calculateLineTotal(quantity, unitPrice) {
    const validQuantity = this.validateNumber(quantity, 'quantity', false);
    const validUnitPrice = this.validateNumber(unitPrice, 'unitPrice', true);
    
    const lineTotal = validQuantity * validUnitPrice;
    return Math.round(lineTotal * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
  }

  // Calculate subtotal from items array
  calculateSubtotal(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return 0;
    }

    let subtotal = 0;
    
    for (const item of items) {
      if (!item.quantity || item.unitPrice === null || item.unitPrice === undefined) {
        throw new Error(`Invalid item: ${JSON.stringify(item)}. Missing quantity or unitPrice`);
      }
      
      const lineTotal = this.calculateLineTotal(item.quantity, item.unitPrice);
      subtotal += lineTotal;
    }
    
    return Math.round(subtotal * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
  }

  // Calculate tax amount - now fully configurable
  calculateTax(subtotal, taxRate = null) {
    const validSubtotal = this.validateNumber(subtotal, 'subtotal', true);
    
    // If taxRate is null, undefined, or 0, return 0 (no tax)
    if (taxRate === null || taxRate === undefined || taxRate === 0) {
      return 0;
    }
    
    const validTaxRate = this.validateNumber(taxRate, 'taxRate', true);
    
    if (validTaxRate > 100) {
      throw new Error('Tax rate cannot exceed 100%');
    }
    
    if (validTaxRate === 0) {
      return 0;
    }
    
    const taxAmount = (validSubtotal * validTaxRate) / 100;
    return Math.round(taxAmount * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
  }

  // Calculate discount amount
  calculateDiscount(subtotal, discountRate = 0, discountAmount = 0) {
    const validSubtotal = this.validateNumber(subtotal, 'subtotal', true);
    
    let discount = 0;
    
    if (discountAmount > 0) {
      discount = this.validateNumber(discountAmount, 'discountAmount', true);
      if (discount > validSubtotal) {
        throw new Error('Discount amount cannot exceed subtotal');
      }
    } else if (discountRate > 0) {
      const validDiscountRate = this.validateNumber(discountRate, 'discountRate', true);
      if (validDiscountRate > 100) {
        throw new Error('Discount rate cannot exceed 100%');
      }
      discount = (validSubtotal * validDiscountRate) / 100;
    }
    
    return Math.round(discount * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
  }

  // Calculate grand total
  calculateGrandTotal(subtotal, taxAmount = 0, shippingCost = 0, discountAmount = 0) {
    const validSubtotal = this.validateNumber(subtotal, 'subtotal', true);
    const validTaxAmount = this.validateNumber(taxAmount, 'taxAmount', true);
    const validShippingCost = this.validateNumber(shippingCost, 'shippingCost', true);
    const validDiscountAmount = this.validateNumber(discountAmount, 'discountAmount', true);
    
    const grandTotal = validSubtotal + validTaxAmount + validShippingCost - validDiscountAmount;
    
    if (grandTotal < 0) {
      throw new Error('Grand total cannot be negative. Check discount amounts.');
    }
    
    return Math.round(grandTotal * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
  }

  // Complete invoice calculation with validation
  calculateInvoiceTotal(items, options = {}) {
    const {
      taxRate = null, // Tax is now explicitly optional
      shippingCost = 0,
      discountRate = 0,
      discountAmount = 0,
      currency = this.defaultCurrency,
      taxEnabled = false // New flag to explicitly enable/disable tax
    } = options;

    try {
      // Validate items array
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items array is required and cannot be empty');
      }

      // Calculate subtotal
      const subtotal = this.calculateSubtotal(items);
      
      // Calculate tax - only if enabled and rate is provided
      const effectiveTaxRate = taxEnabled && taxRate !== null && taxRate !== undefined ? taxRate : 0;
      const taxAmount = this.calculateTax(subtotal, effectiveTaxRate);
      
      // Calculate discount
      const discount = this.calculateDiscount(subtotal, discountRate, discountAmount);
      
      // Validate shipping cost
      const validShippingCost = this.validateNumber(shippingCost, 'shippingCost', true);
      
      // Calculate grand total
      const grandTotal = this.calculateGrandTotal(subtotal, taxAmount, validShippingCost, discount);

      // Return complete calculation breakdown
      return {
        success: true,
        calculations: {
          subtotal,
          taxAmount,
          taxRate: effectiveTaxRate,
          taxEnabled: taxEnabled && effectiveTaxRate > 0,
          shippingCost: validShippingCost,
          discount,
          grandTotal,
          currency,
          itemCount: items.length,
          calculatedAt: new Date().toISOString()
        },
        validation: {
          isValid: true,
          errors: [],
          warnings: this.generateWarnings(subtotal, taxAmount, validShippingCost, discount, grandTotal)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        calculations: null,
        validation: {
          isValid: false,
          errors: [error.message],
          warnings: []
        }
      };
    }
  }

  // Generate warnings for unusual values
  generateWarnings(subtotal, taxAmount, shippingCost, discount, grandTotal) {
    const warnings = [];
    
    if (grandTotal === 0) {
      warnings.push('Grand total is zero - please verify calculations');
    }
    
    if (discount > subtotal * 0.5) {
      warnings.push('Discount is more than 50% of subtotal - please verify');
    }
    
    if (shippingCost > subtotal) {
      warnings.push('Shipping cost exceeds subtotal - please verify');
    }
    
    // Only warn about missing tax if it seems like it should be applied
    if (taxAmount === 0 && subtotal > 0) {
      warnings.push('No tax applied - this invoice is tax-free');
    }
    
    if (grandTotal > 10000000) { // 10 million IDR
      warnings.push('Large invoice amount - please double-check calculations');
    }
    
    return warnings;
  }

  // Recalculate existing invoice to verify accuracy
  recalculateInvoice(invoice) {
    try {
      const items = invoice.items || [];
      const options = {
        taxRate: invoice.calculations?.taxRate || this.defaultTaxRate,
        shippingCost: invoice.calculations?.shippingCost || 0,
        discountAmount: invoice.calculations?.discount || 0,
        currency: invoice.calculations?.currency || this.defaultCurrency
      };

      const recalculated = this.calculateInvoiceTotal(items, options);
      
      if (recalculated.success) {
        // Compare with existing values
        const existingGrandTotal = invoice.calculations?.grandTotal || 0;
        const calculatedGrandTotal = recalculated.calculations.grandTotal;
        
        const difference = Math.abs(existingGrandTotal - calculatedGrandTotal);
        const isAccurate = difference < 0.01; // Allow 1 cent difference due to rounding
        
        return {
          success: true,
          isAccurate,
          difference,
          original: {
            grandTotal: existingGrandTotal,
            subtotal: invoice.calculations?.subtotal || 0,
            taxAmount: invoice.calculations?.totalTax || invoice.calculations?.taxAmount || 0
          },
          recalculated: recalculated.calculations,
          recommendations: isAccurate ? [] : ['Invoice calculations need to be updated']
        };
      }
      
      return recalculated;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        isAccurate: false
      };
    }
  }

  // Calculate payment schedule for down payments
  calculatePaymentSchedule(grandTotal, options = {}) {
    const {
      scheduleType = 'down_payment',
      downPaymentPercentage = 30,
      downPaymentDays = 15,
      finalPaymentDays = 30,
      invoiceDate = new Date()
    } = options;

    try {
      const validGrandTotal = this.validateNumber(grandTotal, 'grandTotal', false);
      const validDownPaymentPercentage = this.validateNumber(downPaymentPercentage, 'downPaymentPercentage', false);
      
      if (validDownPaymentPercentage > 100) {
        throw new Error('Down payment percentage cannot exceed 100%');
      }
      
      if (validDownPaymentPercentage <= 0) {
        throw new Error('Down payment percentage must be greater than 0');
      }

      // Calculate payment amounts
      const downPaymentAmount = Math.round((validGrandTotal * validDownPaymentPercentage / 100) * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
      const remainingBalance = Math.round((validGrandTotal - downPaymentAmount) * Math.pow(10, this.precision)) / Math.pow(10, this.precision);

      // Calculate due dates
      const invoiceDateObj = new Date(invoiceDate);
      const downPaymentDueDate = new Date(invoiceDateObj);
      downPaymentDueDate.setDate(invoiceDateObj.getDate() + downPaymentDays);
      
      const finalPaymentDueDate = new Date(invoiceDateObj);
      finalPaymentDueDate.setDate(invoiceDateObj.getDate() + finalPaymentDays);

      return {
        success: true,
        paymentSchedule: {
          scheduleType,
          totalAmount: validGrandTotal,
          downPayment: {
            percentage: validDownPaymentPercentage,
            amount: downPaymentAmount,
            dueDate: downPaymentDueDate.toISOString().split('T')[0],
            status: 'pending'
          },
          remainingBalance: {
            amount: remainingBalance,
            dueDate: finalPaymentDueDate.toISOString().split('T')[0],
            status: 'pending'
          },
          paymentStatus: {
            status: 'pending', // 'pending', 'partial', 'paid'
            totalPaid: 0,
            remainingAmount: validGrandTotal,
            lastPaymentDate: null,
            paymentHistory: []
          }
        },
        validation: {
          isValid: true,
          errors: [],
          warnings: this.generatePaymentScheduleWarnings(downPaymentAmount, remainingBalance, validGrandTotal)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        paymentSchedule: null,
        validation: {
          isValid: false,
          errors: [error.message],
          warnings: []
        }
      };
    }
  }

  // Generate warnings for payment schedules
  generatePaymentScheduleWarnings(downPaymentAmount, remainingBalance, grandTotal) {
    const warnings = [];
    
    const downPaymentRatio = downPaymentAmount / grandTotal;
    
    if (downPaymentRatio < 0.1) {
      warnings.push('Down payment is less than 10% of total - consider increasing for better cash flow');
    }
    
    if (downPaymentRatio > 0.8) {
      warnings.push('Down payment is more than 80% of total - consider reducing to improve customer experience');
    }
    
    if (remainingBalance < 50000) { // Less than 50k IDR
      warnings.push('Remaining balance is very small - consider requesting full payment upfront');
    }
    
    return warnings;
  }

  // Update payment status and track payments
  updatePaymentStatus(paymentSchedule, paymentAmount, paymentDate = new Date()) {
    try {
      const validPaymentAmount = this.validateNumber(paymentAmount, 'paymentAmount', false);
      const currentPaid = paymentSchedule.paymentStatus.totalPaid || 0;
      const newTotalPaid = currentPaid + validPaymentAmount;
      const totalAmount = paymentSchedule.totalAmount;
      
      if (newTotalPaid > totalAmount) {
        throw new Error('Payment amount exceeds remaining balance');
      }

      // Update payment history
      const paymentRecord = {
        amount: validPaymentAmount,
        date: new Date(paymentDate).toISOString(),
        type: 'payment'
      };

      // Determine new status
      let newStatus = 'pending';
      if (newTotalPaid >= totalAmount) {
        newStatus = 'paid';
      } else if (newTotalPaid > 0) {
        newStatus = 'partial';
      }

      // Update down payment status
      if (newTotalPaid >= paymentSchedule.downPayment.amount && paymentSchedule.downPayment.status === 'pending') {
        paymentSchedule.downPayment.status = 'paid';
      }

      // Update remaining balance status
      if (newTotalPaid >= totalAmount && paymentSchedule.remainingBalance.status === 'pending') {
        paymentSchedule.remainingBalance.status = 'paid';
      }

      return {
        success: true,
        updatedSchedule: {
          ...paymentSchedule,
          paymentStatus: {
            status: newStatus,
            totalPaid: newTotalPaid,
            remainingAmount: totalAmount - newTotalPaid,
            lastPaymentDate: new Date(paymentDate).toISOString(),
            paymentHistory: [...(paymentSchedule.paymentStatus.paymentHistory || []), paymentRecord]
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Format currency consistently
  formatCurrency(amount, currency = 'IDR', locale = 'id-ID') {
    const validAmount = this.validateNumber(amount, 'amount', true);
    
    if (currency === 'IDR') {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(validAmount).replace('IDR', 'Rp').trim();
    }
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(validAmount);
  }
}

export default InvoiceCalculations;