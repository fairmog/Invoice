import OpenAIService from './openai-service.js';
import OptimizedPrompts from './optimized-prompts.js';
import { IndonesianPrompts } from './indonesian-prompts.js';

class AIDataExtractor {
  constructor(openaiService = null) {
    this.openai = openaiService || new OpenAIService();
  }

  async extractCustomerData(rawText) {
    const prompt = IndonesianPrompts.extractCustomerData(rawText);

    const response = await this.openai.createChatCompletion({
      messages: [
        {
          role: "system",
          content: "Anda adalah asisten ekstraksi data berbahasa Indonesia. Ekstrak informasi dari teks dan kembalikan JSON yang valid saja."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.openai.getTokenLimit('extraction')
    });

    if (!response.success) {
      throw new Error(`Customer data extraction failed: ${response.error}`);
    }

    return this.openai.parseJSONResponse(response.content);
  }

  async extractProductData(rawText, merchantCatalog = null) {
    const prompt = IndonesianPrompts.extractProductData(rawText, merchantCatalog);

    const response = await this.openai.createChatCompletion({
      messages: [
        {
          role: "system",
          content: "Anda adalah asisten ekstraksi data produk berbahasa Indonesia. Ekstrak informasi produk dari teks dan kembalikan JSON yang valid saja."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.openai.getTokenLimit('extraction')
    });

    if (!response.success) {
      throw new Error(`Product data extraction failed: ${response.error}`);
    }

    return this.openai.parseJSONResponse(response.content);
  }

  async processCompleteOrder(rawText, merchantCatalog = null) {
    const prompt = OptimizedPrompts.processCompleteOrder(rawText, merchantCatalog);

    const response = await this.openai.createChatCompletion({
      messages: [
        {
          role: "system",
          content: "Extract order data from text. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.openai.getTokenLimit('extraction')
    });

    if (!response.success) {
      throw new Error(`Complete order processing failed: ${response.error}`);
    }

    // DEBUG: Log raw AI response to check if paymentSchedule is included
    console.log('🤖 AI Raw Response (first 1000 chars):', response.content.substring(0, 1000));
    
    const parseResult = this.openai.parseJSONResponse(response.content, true);
    
    // DEBUG: Check if JSON parsing was successful
    if (!parseResult.success) {
      console.log('❌ JSON parsing failed:', parseResult.error);
      console.log('🤖 Full response content:', response.content);
      throw new Error(`JSON parsing failed: ${parseResult.error}`);
    }
    
    // DEBUG: Log parsed payment schedule data
    console.log('🔍 Full extractedData structure:', JSON.stringify(parseResult.data, null, 2));
    console.log('🔍 Extracted paymentSchedule:', parseResult.data.paymentSchedule);
    console.log('🔍 paymentSchedule.enablePaymentSchedule:', parseResult.data.paymentSchedule?.enablePaymentSchedule);
    console.log('🔍 paymentSchedule.downPaymentType:', parseResult.data.paymentSchedule?.downPaymentType);
    console.log('🔍 paymentSchedule.downPaymentValue:', parseResult.data.paymentSchedule?.downPaymentValue);
    console.log('🔍 paymentSchedule.downPaymentPercentage (legacy):', parseResult.data.paymentSchedule?.downPaymentPercentage);
    console.log('🔍 paymentSchedule.isImmediateDownPayment:', parseResult.data.paymentSchedule?.isImmediateDownPayment);
    console.log('🔍 paymentSchedule.finalPaymentDate:', parseResult.data.paymentSchedule?.finalPaymentDate);
    
    return parseResult.data;
  }

  async enhanceWithMerchantContext(extractedData, merchantInfo) {
    const prompt = `Enhance this extracted order data with merchant context:

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Merchant Information:
${JSON.stringify(merchantInfo, null, 2)}

Enhance the order with:
1. Merchant's business details
2. Tax calculations based on location
3. Shipping options and costs
4. Payment terms and methods
5. Invoice formatting preferences

Return the enhanced order as JSON with the same structure but additional merchant-specific fields.`;

    const response = await this.openai.createChatCompletion({
      messages: [
        {
          role: "system",
          content: "You are a merchant data enhancement assistant. Enhance order data with merchant context and return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.openai.getTokenLimit('extraction')
    });

    if (!response.success) {
      throw new Error(`Merchant context enhancement failed: ${response.error}`);
    }

    return this.openai.parseJSONResponse(response.content);
  }
}

export default AIDataExtractor;
