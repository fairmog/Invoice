import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

class AIAutoLearning {
  constructor(database) {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    this.openai = new OpenAI({
      apiKey: this.apiKey,
    });
    this.database = database;
  }

  async analyzeExtractedData(extractedData, merchantId = null) {
    console.log('Analyzing extracted data for auto-learning:', extractedData);
    
    const results = {
      customerAnalysis: null,
      productAnalysis: [],
      newCustomerDetected: false,
      newProductsDetected: false,
      customerData: null,
      productData: []
    };

    // Analyze customer data
    if (extractedData.customer) {
      results.customerAnalysis = await this.analyzeCustomer(extractedData.customer);
      results.newCustomerDetected = results.customerAnalysis.isNew;
      results.customerData = results.customerAnalysis.data;
    }

    // Analyze product data
    if (extractedData.items && Array.isArray(extractedData.items)) {
      for (const item of extractedData.items) {
        const productAnalysis = await this.analyzeProduct(item, merchantId);
        results.productAnalysis.push(productAnalysis);
        if (productAnalysis.isNew) {
          results.newProductsDetected = true;
          results.productData.push(productAnalysis.data);
        }
      }
    }

    return results;
  }

  async analyzeCustomer(customerData) {
    try {
      // Use smart matching to check if customer already exists
      // First attempt smart matching without creating a new customer
      let matchedCustomer = null;
      
      // Try email match first
      if (customerData.email) {
        matchedCustomer = await this.database.getCustomer(customerData.email);
      }
      
      // If no email match, try phone match
      if (!matchedCustomer && customerData.phone) {
        const normalizedPhone = this.database.normalizePhone(customerData.phone);
        const customers = await this.database.getAllCustomers(1000, 0);
        matchedCustomer = customers.find(c => 
          c.phone && this.database.normalizePhone(c.phone) === normalizedPhone
        );
      }
      
      // If no exact match, try fuzzy name match
      if (!matchedCustomer && customerData.name && customerData.name.length > 3) {
        matchedCustomer = this.database.findFuzzyNameMatch(customerData.name);
      }
      
      if (matchedCustomer) {
        console.log(`Customer matched (${matchedCustomer.name}):`, matchedCustomer.email || matchedCustomer.phone);
        return {
          isNew: false,
          confidence: 1.0,
          action: 'existing',
          data: matchedCustomer
        };
      }

      // Customer is new - analyze confidence level
      const confidence = this.calculateCustomerConfidence(customerData);
      
      const analysis = {
        isNew: true,
        confidence: confidence,
        action: this.determineAction(confidence),
        data: {
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone || '',
          address: customerData.address || '',
          source: 'ai_auto_learning',
          confidence_score: confidence
        }
      };

      console.log('New customer analysis:', analysis);
      return analysis;

    } catch (error) {
      console.error('Error analyzing customer:', error);
      return {
        isNew: false,
        confidence: 0,
        action: 'error',
        data: null
      };
    }
  }

  async analyzeProduct(productData, merchantId = null) {
    try {
      // Check if product already exists (by name similarity)
      const existingProducts = await this.database.getAllProducts(100, 0, null, true, merchantId);
      const existingProduct = existingProducts.find(p => 
        this.calculateSimilarity(p.name.toLowerCase(), productData.productName.toLowerCase()) > 0.8
      );

      if (existingProduct) {
        console.log('Product already exists:', existingProduct.name);
        return {
          isNew: false,
          confidence: 1.0,
          action: 'existing',
          data: existingProduct
        };
      }

      // Product is new - analyze confidence level
      const confidence = this.calculateProductConfidence(productData);
      
      const analysis = {
        isNew: true,
        confidence: confidence,
        action: this.determineAction(confidence),
        data: {
          name: productData.productName,
          description: productData.description || '',
          sku: this.generateSKU(productData.productName),
          unit_price: productData.unitPrice || 0,
          category: await this.inferProductCategory(productData.productName),
          stock_quantity: 0,
          min_stock_level: 5,
          source: 'ai_auto_learning',
          confidence_score: confidence
        }
      };

      console.log('New product analysis:', analysis);
      return analysis;

    } catch (error) {
      console.error('Error analyzing product:', error);
      return {
        isNew: false,
        confidence: 0,
        action: 'error',
        data: null
      };
    }
  }

  calculateCustomerConfidence(customerData) {
    let confidence = 0.3; // Base confidence for new customers

    // Boost confidence based on data quality
    if (customerData.email && this.isValidEmail(customerData.email)) {
      confidence += 0.3;
    }
    
    if (customerData.phone && customerData.phone.length >= 10) {
      confidence += 0.2;
    }
    
    if (customerData.name && customerData.name.length > 2) {
      confidence += 0.1;
    }
    
    if (customerData.address && customerData.address.length > 10) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  calculateProductConfidence(productData) {
    let confidence = 0.4; // Base confidence for new products

    // Boost confidence based on data quality
    if (productData.productName && productData.productName.length > 2) {
      confidence += 0.2;
    }
    
    if (productData.unitPrice && productData.unitPrice > 0) {
      confidence += 0.2;
    }
    
    if (productData.description && productData.description.length > 5) {
      confidence += 0.1;
    }
    
    // Check if product name contains specific brand names or categories
    const productName = productData.productName.toLowerCase();
    const knownBrands = ['apple', 'samsung', 'iphone', 'macbook', 'sony', 'nike', 'adidas'];
    const knownCategories = ['laptop', 'handphone', 'sepatu', 'tas', 'kemeja', 'celana'];
    
    if (knownBrands.some(brand => productName.includes(brand))) {
      confidence += 0.1;
    }
    
    if (knownCategories.some(cat => productName.includes(cat))) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  determineAction(confidence) {
    // DISABLED: Auto-learning product addition to prevent product name modifications
    // Always require manual review to preserve original product names from user input
    return 'manual_review'; // Force manual review for all products to prevent confusion
  }

  async processAutoLearning(analysis) {
    const results = {
      customersAdded: 0,
      productsAdded: 0,
      confirmationsNeeded: [],
      errors: []
    };

    // Process customer auto-learning
    if (analysis.customerAnalysis && analysis.customerAnalysis.isNew) {
      try {
        if (analysis.customerAnalysis.action === 'auto_add') {
          await this.database.saveCustomer(analysis.customerAnalysis.data);
          results.customersAdded++;
          console.log('Auto-added customer:', analysis.customerAnalysis.data.name);
        } else if (analysis.customerAnalysis.action === 'smart_confirm') {
          results.confirmationsNeeded.push({
            type: 'customer',
            action: 'smart_confirm',
            data: analysis.customerAnalysis.data,
            confidence: analysis.customerAnalysis.confidence
          });
        }
      } catch (error) {
        console.error('Error processing customer auto-learning:', error);
        results.errors.push({ type: 'customer', error: error.message });
      }
    }

    // Process product auto-learning
    for (const productAnalysis of analysis.productAnalysis) {
      if (productAnalysis.isNew) {
        try {
          if (productAnalysis.action === 'auto_add') {
            await this.database.createProduct(productAnalysis.data);
            results.productsAdded++;
            console.log('Auto-added product:', productAnalysis.data.name);
          } else if (productAnalysis.action === 'smart_confirm') {
            results.confirmationsNeeded.push({
              type: 'product',
              action: 'smart_confirm',
              data: productAnalysis.data,
              confidence: productAnalysis.confidence
            });
          }
        } catch (error) {
          console.error('Error processing product auto-learning:', error);
          results.errors.push({ type: 'product', error: error.message });
        }
      }
    }

    return results;
  }

  async inferProductCategory(productName) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a product categorization expert. Return only the category name in Indonesian, maximum 2 words."
          },
          {
            role: "user",
            content: `Kategorikan produk ini dalam 1-2 kata bahasa Indonesia: "${productName}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 20
      });
      
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error inferring product category:', error);
      return 'Umum';
    }
  }

  generateSKU(productName) {
    // Generate a simple SKU based on product name
    const cleaned = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const prefix = cleaned.substring(0, 3).padEnd(3, 'X');
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${suffix}`;
  }

  calculateSimilarity(str1, str2) {
    // Simple Levenshtein distance-based similarity
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default AIAutoLearning;
