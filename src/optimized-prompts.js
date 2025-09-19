// Optimized prompts for faster AI processing
// Concise, targeted prompts that reduce token usage and improve accuracy

function getEnabledPaymentMethodsIndonesian(merchantConfig) {
  const methods = [];
  if (merchantConfig.paymentMethods?.bankTransfer?.enabled) methods.push("Transfer Bank");
  if (merchantConfig.paymentMethods?.qris?.enabled) methods.push("QRIS");
  if (merchantConfig.paymentMethods?.cash?.enabled) methods.push("Tunai");
  if (merchantConfig.paymentMethods?.ewallet?.enabled) methods.push("E-Wallet");
  return methods.length > 0 ? methods : ["Transfer Bank", "Tunai"];
}

const OptimizedPrompts = {
  // Streamlined customer data extraction
  extractCustomerData: (rawText) => `Extract customer info from: "${rawText}"
Return JSON only:
{
  "customer": {
    "name": "full name",
    "phone": "phone number", 
    "email": "email if found",
    "address": "complete address"
  }
}`,

  // Streamlined product extraction  
  extractProductData: (rawText, catalog = null) => {
    const catalogHint = catalog ? `\nMatch with catalog: ${JSON.stringify(catalog.slice(0, 5))}` : "";
    return `Extract products from: "${rawText}"${catalogHint}
Return JSON only:
{
  "items": [{
    "productName": "name",
    "quantity": number,
    "unitPrice": number,
    "total": number
  }],
  "orderDetails": {
    "subtotal": number,
    "shipping": number,
    "total": number,
    "currency": "IDR"
  }
}`;
  },

  // Optimized complete order processing
  processCompleteOrder: (rawText, catalog = null) => {
    const today = new Date().toISOString().split('T')[0];
    const catalogHint = catalog ? `\nCatalog: ${JSON.stringify(catalog)}` : "";
    
    return `Process order: "${rawText}"${catalogHint}
Use today's date: ${today}

PRODUCT CATALOG MATCHING RULES:
- PRESERVE ORIGINAL PRODUCT NAME: Always use exact product name from user input
- If catalog is provided, try to match product names to catalog items for PRICING ONLY
- Use fuzzy matching for price lookup: "lolly" should match "lolly", "lolly bag", etc.
- If price not specified in message but product matches catalog, use catalog price
- Set matchedFromCatalog: true when using catalog price
- Set matchedFromCatalog: false when price comes from user message
- NEVER change, enhance, or modify the original product name from user input
- Examples: "linea 28 sumba" → productName stays "linea 28 sumba" (use catalog price if found)
- Examples: "lolly 13pcs harga 50000" → productName "lolly", price from user message

DISCOUNT EXTRACTION RULES (PROCESS FIRST - HIGH PRIORITY):
- Extract discounts from keywords: "discount", "diskon", "potongan", "potong"
- Handle percentage format: "discount 10%", "diskon 10 persen" → extract as number (10) with discountType: "percentage"
- Handle fixed amount: "discount 50000", "diskon 50rb" → extract as number (50000) with discountType: "fixed"
- CRITICAL: "discount X%" should NEVER be interpreted as down payment - it is ALWAYS a discount
- Examples: "discount 10%" → discount: 10, discountType: "percentage" (NOT down payment)
- Examples: "diskon 25000" → discount: 25000, discountType: "fixed"
- IMPORTANT: For percentage discounts, store ONLY the percentage number (10), NOT the calculated amount
- If discount found: set discount amount and discountType ("percentage" or "fixed")
- If no discount: set discount: 0, discountType: "fixed"

PAYMENT SCHEDULE EXTRACTION RULES (PROCESS AFTER DISCOUNTS):
- Extract down payment requests ONLY from these exact keywords: "Down Payment", "DP", "uang muka", "bayar muka"
- NEVER interpret "discount X%" as down payment - only "DP X%" or "Down Payment X%"
- Handle percentage format: "Down Payment 20%", "DP 30%", "uang muka 25%" (but NOT "discount X%")
- Detect immediate payment keywords: "DP dulu", "bayar dulu", "down payment first" → set isImmediateDownPayment: true
- Extract final payment date from: "sisa pembayaran tanggal X", "sisanya di tanggal X", "final payment X", "pembayaran sisanya di tanggal X"
- Date formats: "20/08/2025", "20-08-2025", "2025-08-20" → convert to YYYY-MM-DD format
- Examples: "DP dulu 10%" → immediate DP, "pembayaran sisanya di tanggal 20/08/2025" → final date
- If down payment found: set enablePaymentSchedule: true, downPaymentPercentage: number
- If no down payment: set enablePaymentSchedule: false

CUSTOM NOTES EXTRACTION RULES:
- Extract custom notes from keywords: "Catatan:", "Note:", "Catatan :", "catatan:", "notes:", "Notes:"
- Extract everything after these keywords as custom notes
- Examples: "Catatan: lolly nya warna hitam 2 putih 2" → customNotes: "lolly nya warna hitam 2 putih 2"
- Examples: "Note: deliver by 3 PM" → customNotes: "deliver by 3 PM"  
- Examples: "catatan : hati-hati fragile" → customNotes: "hati-hati fragile"
- Clean up the text: remove leading/trailing spaces, preserve line breaks
- If no custom notes found: set customNotes: ""

Return JSON only:
{
  "customer": {
    "name": "name",
    "phone": "phone",
    "email": "email",
    "address": "address"
  },
  "items": [{
    "productName": "name",
    "quantity": number,
    "unitPrice": number,
    "total": number,
    "matchedFromCatalog": boolean
  }],
  "orderDetails": {
    "subtotal": number,
    "tax": number,
    "shipping": number,
    "discount": number,
    "discountType": "percentage|fixed",
    "total": number,
    "currency": "IDR"
  },
  "paymentSchedule": {
    "enablePaymentSchedule": boolean,
    "downPaymentPercentage": number,
    "isImmediateDownPayment": boolean,
    "finalPaymentDate": "extract final payment date if mentioned (format: YYYY-MM-DD), otherwise empty string"
  },
  "customNotes": "extract custom notes after Catatan:/Note: keywords, empty string if not found",
  "dueDate": "extract due date from message if mentioned, otherwise leave empty string"
}`;
  },

  // Highly optimized invoice generation with payment schedule support
  generateInvoice: (orderData, merchantConfig, paymentOptions = {}) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      // Always generate a due date - default to same day as invoice (immediate payment expected)
      const defaultDueDate = today; // Same as invoice date for immediate payment
      const dueDate = orderData.dueDate || merchantConfig.defaultDueDate || defaultDueDate;
      const invoiceNum = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      
      // Get tax configuration from merchant settings
      const taxEnabled = merchantConfig.taxEnabled || false;
      const taxRate = taxEnabled ? (merchantConfig.taxRate || 0) : 0;
      const taxName = merchantConfig.taxName || 'Tax';
      const taxDescription = merchantConfig.taxDescription || '';
      
      // Get payment schedule configuration
      const enablePaymentSchedule = paymentOptions.enablePaymentSchedule || false;
      const downPaymentPercentage = paymentOptions.downPaymentPercentage || 30;
      
      // Use extracted dates or fallback to day-based calculation
      const extractedFinalDate = paymentOptions.finalPaymentDate;
      const hasImmediateDP = paymentOptions.isImmediateDownPayment || false; // For "DP dulu" cases
      
      const downPaymentDays = hasImmediateDP ? 0 : (paymentOptions.downPaymentDays || 15);
      const finalPaymentDays = paymentOptions.finalPaymentDays || 30;
      
      // Validate required data exists
      if (!orderData.customer?.name) {
        throw new Error('Customer name is required for invoice generation');
      }
      if (!orderData.items || orderData.items.length === 0) {
        throw new Error('At least one item is required for invoice generation');
      }

      // Pre-calculate values to avoid complex expressions in JSON template
      const subtotal = orderData.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
      const taxAmount = taxEnabled && taxRate > 0 ? Math.round(subtotal * (taxRate / 100)) : 0;
      const shippingCost = orderData.orderDetails?.shipping || 0;
      // Calculate discount based on type (percentage or fixed)
      const discountValue = orderData.orderDetails?.discount || 0;
      const discountType = orderData.orderDetails?.discountType || 'fixed';
      let discountAmount = 0;
      
      if (discountValue > 0) {
        if (discountType === 'percentage') {
          // For percentage discounts, discountValue should be the percentage (e.g., 10 for 10%)
          // If discountValue seems too large (>100), assume it's already a calculated amount
          if (discountValue > 100) {
            // Likely already calculated amount, use as-is
            discountAmount = discountValue;
          } else {
            // Percentage value, calculate from subtotal
            discountAmount = Math.round(subtotal * (discountValue / 100));
          }
        } else {
          // Fixed amount discount
          discountAmount = discountValue;
        }
      }
      const grandTotal = subtotal + taxAmount + shippingCost - discountAmount;
      
      // Pre-calculate payment schedule values
      const downPaymentAmount = Math.round(grandTotal * (downPaymentPercentage / 100));
      const remainingBalance = grandTotal - downPaymentAmount;
      
      // Down payment due date - always same day as invoice for consistency and immediate payment
      const downPaymentDueDate = today; // Same as invoice date, consistent with main due date
      
      // Use extracted final payment date if available, otherwise calculate from days
      const finalPaymentDueDate = extractedFinalDate && extractedFinalDate.trim() !== '' ? 
        extractedFinalDate : 
        new Date(new Date(today).getTime() + finalPaymentDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return `Create invoice JSON from order data.
Customer: ${orderData.customer?.name} | ${orderData.customer?.phone}
Items: ${orderData.items?.map(i => `${i.productName} (${i.quantity}x @${i.unitPrice})`).join(', ')}
Merchant: ${merchantConfig.businessName || merchantConfig.name || 'Business Name'}

Return JSON only:
{
  "invoice": {
    "header": {
      "invoiceNumber": "${invoiceNum}",
      "invoiceDate": "${today}",
      "dueDate": "${dueDate}",
      "status": "draft"
    },
    "merchant": {
      "businessName": "${merchantConfig.businessName || merchantConfig.name || 'Business Name'}",
      "address": "${merchantConfig.address || 'Business Address'}",
      "phone": "${merchantConfig.phone || 'Business Phone'}",
      "email": "${merchantConfig.email || 'business@email.com'}"
    },
    "customer": {
      "name": "${orderData.customer?.name || 'Customer'}",
      "phone": "${orderData.customer?.phone || ''}",
      "email": "${orderData.customer?.email || ''}",
      "address": "${orderData.customer?.address || ''}"
    },
    "items": ${JSON.stringify(orderData.items?.map((item, idx) => ({
      lineNumber: idx + 1,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice
    })) || [])},
    "calculations": {
      "subtotal": ${subtotal},
      "totalTax": ${taxAmount},
      "shippingCost": ${shippingCost},
      "discount": ${discountAmount},
      "discountType": "${orderData.orderDetails?.discountType || 'fixed'}",
      "grandTotal": ${grandTotal},
      "currency": "IDR",
      "taxEnabled": ${taxEnabled},
      "taxRate": ${taxRate},
      "taxName": "${taxName}",
      "taxDescription": "${taxDescription}"
    },
    ${enablePaymentSchedule ? `"paymentSchedule": {
      "scheduleType": "down_payment",
      "totalAmount": ${grandTotal},
      "downPayment": {
        "percentage": ${downPaymentPercentage},
        "amount": ${downPaymentAmount},
        "dueDate": "${downPaymentDueDate}",
        "status": "pending"
      },
      "remainingBalance": {
        "amount": ${remainingBalance},
        "dueDate": "${finalPaymentDueDate}",
        "status": "pending"
      },
      "paymentStatus": {
        "status": "pending",
        "totalPaid": 0,
        "remainingAmount": ${grandTotal},
        "lastPaymentDate": null,
        "paymentHistory": []
      }
    },` : ''}
    "payment": {
      "paymentTerms": ${enablePaymentSchedule ? `"DOWN_PAYMENT_${downPaymentPercentage}"` : '"NET_30"'},
      "paymentMethods": ${JSON.stringify(getEnabledPaymentMethodsIndonesian(merchantConfig))},
      "paymentInstructions": ${enablePaymentSchedule ? `"Down payment ${downPaymentPercentage}% due immediately, remaining balance due as agreed"` : '"Pembayaran segera"'},
      "bankDetails": ${merchantConfig.paymentMethods?.bankTransfer?.enabled ? JSON.stringify({
        bankName: merchantConfig.paymentMethods.bankTransfer.bankName,
        accountNumber: merchantConfig.paymentMethods.bankTransfer.accountNumber,
        accountName: merchantConfig.paymentMethods.bankTransfer.accountName
      }) : 'null'}
    },
    "notes": {
      "publicNotes": "${orderData.customNotes || 'Extract special requests from message'}",
      "termsAndConditions": "${merchantConfig.termsAndConditions || merchantConfig.paymentTerms || 'Standard payment terms apply'}"
    },
    "metadata": {
      "source": "whatsapp"
    }
  }
}`;
    } catch (error) {
      throw new Error(`Error generating invoice prompt: ${error.message}`);
    }
  },

  // Optimized validation
  validateInvoice: (invoice) => `Validate this invoice (be lenient with calculations and missing optional fields):
${JSON.stringify(invoice, null, 2)}

Check only critical issues:
- Customer name present
- At least one item exists
- Total amount is reasonable (>0)
- Allow empty due dates (drafts are OK)
- Allow minor calculation differences (±1% is acceptable)

Return JSON only (always mark as valid unless critical errors):
{
  "isValid": true,
  "errors": [],
  "warnings": [{"field": "fieldName", "message": "description"}],
  "completeness": {
    "score": 0.9,
    "missingFields": [],
    "requiredFieldsComplete": true
  }
}`,

  // Optimized product matching
  matchProducts: (extractedItems, catalog) => `Match products with catalog:
Items: ${JSON.stringify(extractedItems)}
Catalog: ${JSON.stringify(catalog.slice(0, 10))}

Return JSON only:
{
  "matchedItems": [{
    "extractedName": "name",
    "catalogMatch": {
      "id": "id",
      "name": "name", 
      "price": number,
      "confidence": 0-1
    }
  }],
  "suggestions": [{
    "type": "price_update",
    "item": "name",
    "suggested_price": number
  }]
}`
};

export default OptimizedPrompts;