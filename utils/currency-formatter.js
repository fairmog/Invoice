// Centralized currency formatting utility
// Ensures consistent currency display across the entire application

class CurrencyFormatter {
  constructor() {
    this.supportedCurrencies = {
      'IDR': {
        locale: 'id-ID',
        symbol: 'Rp',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      },
      'USD': {
        locale: 'en-US',
        symbol: '$',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      },
      'EUR': {
        locale: 'de-DE',
        symbol: '€',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      },
      'SGD': {
        locale: 'en-SG',
        symbol: 'S$',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      },
      'MYR': {
        locale: 'ms-MY',
        symbol: 'RM',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    };
    
    this.defaultCurrency = 'IDR';
    this.defaultLocale = 'id-ID';
  }

  // Validate amount input
  validateAmount(amount) {
    if (amount === null || amount === undefined) {
      return 0;
    }
    
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;
    
    if (isNaN(num)) {
      console.warn('Invalid amount provided to currency formatter:', amount);
      return 0;
    }
    
    return Math.max(0, num); // Ensure non-negative
  }

  // Format currency with proper validation
  format(amount, currency = this.defaultCurrency, options = {}) {
    try {
      const validAmount = this.validateAmount(amount);
      const currencyConfig = this.supportedCurrencies[currency.toUpperCase()];
      
      if (!currencyConfig) {
        console.warn(`Unsupported currency: ${currency}, falling back to ${this.defaultCurrency}`);
        currency = this.defaultCurrency;
      }
      
      const config = this.supportedCurrencies[currency.toUpperCase()] || this.supportedCurrencies[this.defaultCurrency];
      const locale = options.locale || config.locale;
      
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: options.minimumFractionDigits ?? config.minimumFractionDigits,
        maximumFractionDigits: options.maximumFractionDigits ?? config.maximumFractionDigits
      });
      
      let formatted = formatter.format(validAmount);
      
      // Special handling for IDR to use Rp instead of IDR
      if (currency.toUpperCase() === 'IDR') {
        formatted = formatted.replace(/IDR\s?/g, 'Rp').trim();
      }
      
      return formatted;
      
    } catch (error) {
      console.error('Currency formatting error:', error);
      // Fallback formatting
      return this.fallbackFormat(amount, currency);
    }
  }

  // Fallback formatting in case of errors
  fallbackFormat(amount, currency = this.defaultCurrency) {
    const validAmount = this.validateAmount(amount);
    const config = this.supportedCurrencies[currency.toUpperCase()] || this.supportedCurrencies[this.defaultCurrency];
    
    if (currency.toUpperCase() === 'IDR') {
      return `Rp ${validAmount.toLocaleString('id-ID')}`;
    }
    
    return `${config.symbol}${validAmount.toFixed(config.maximumFractionDigits)}`;
  }

  // Parse currency string back to number
  parse(currencyString) {
    if (typeof currencyString !== 'string') {
      return this.validateAmount(currencyString);
    }
    
    // Remove all currency symbols and non-numeric characters except decimal points and minus signs
    const cleaned = currencyString.replace(/[^\d.-]/g, '');
    const number = parseFloat(cleaned);
    
    return isNaN(number) ? 0 : number;
  }

  // Format for different contexts
  formatForDisplay(amount, currency = this.defaultCurrency) {
    return this.format(amount, currency);
  }

  formatForAPI(amount, currency = this.defaultCurrency) {
    const validAmount = this.validateAmount(amount);
    return {
      amount: validAmount,
      currency: currency.toUpperCase(),
      formatted: this.format(validAmount, currency)
    };
  }

  formatForPrint(amount, currency = this.defaultCurrency) {
    return this.format(amount, currency, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  }

  // Get currency symbol
  getSymbol(currency = this.defaultCurrency) {
    const config = this.supportedCurrencies[currency.toUpperCase()];
    return config ? config.symbol : this.supportedCurrencies[this.defaultCurrency].symbol;
  }

  // Check if currency is supported
  isSupported(currency) {
    return this.supportedCurrencies.hasOwnProperty(currency.toUpperCase());
  }

  // Get all supported currencies
  getSupportedCurrencies() {
    return Object.keys(this.supportedCurrencies);
  }

  // Format breakdown for invoices (subtotal, tax, total, etc.)
  formatBreakdown(calculations, currency = this.defaultCurrency) {
    try {
      return {
        subtotal: this.format(calculations.subtotal, currency),
        taxAmount: this.format(calculations.taxAmount || calculations.totalTax, currency),
        shippingCost: this.format(calculations.shippingCost, currency),
        discount: this.format(calculations.discount, currency),
        grandTotal: this.format(calculations.grandTotal, currency),
        currency: currency.toUpperCase()
      };
    } catch (error) {
      console.error('Error formatting currency breakdown:', error);
      return {
        subtotal: this.fallbackFormat(calculations.subtotal, currency),
        taxAmount: this.fallbackFormat(calculations.taxAmount || calculations.totalTax, currency),
        shippingCost: this.fallbackFormat(calculations.shippingCost, currency),
        discount: this.fallbackFormat(calculations.discount, currency),
        grandTotal: this.fallbackFormat(calculations.grandTotal, currency),
        currency: currency.toUpperCase()
      };
    }
  }

  // Validate currency amounts in an invoice
  validateInvoiceAmounts(invoice) {
    const errors = [];
    const warnings = [];
    
    try {
      const calculations = invoice.calculations || {};
      
      // Check if amounts are valid numbers
      const amounts = {
        subtotal: calculations.subtotal,
        taxAmount: calculations.taxAmount || calculations.totalTax,
        shippingCost: calculations.shippingCost,
        discount: calculations.discount,
        grandTotal: calculations.grandTotal
      };
      
      for (const [field, amount] of Object.entries(amounts)) {
        if (amount !== undefined && amount !== null) {
          const validated = this.validateAmount(amount);
          if (validated !== amount && amount !== 0) {
            warnings.push(`${field} was corrected from ${amount} to ${validated}`);
          }
        }
      }
      
      // Check currency consistency
      const currency = calculations.currency || this.defaultCurrency;
      if (!this.isSupported(currency)) {
        errors.push(`Unsupported currency: ${currency}`);
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        currency
      };
      
    } catch (error) {
      return {
        isValid: false,
        errors: [`Currency validation error: ${error.message}`],
        warnings: [],
        currency: this.defaultCurrency
      };
    }
  }
}

// Singleton instance
const currencyFormatter = new CurrencyFormatter();

export default currencyFormatter;
export { CurrencyFormatter };