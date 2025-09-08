import OpenAI from 'openai';
import AppConfig from '../config/app-config.js';

/**
 * Centralized OpenAI service for the entire application
 * Implements singleton pattern to avoid multiple instances
 */
class OpenAIService {
  constructor(config = null) {
    if (OpenAIService.instance) {
      return OpenAIService.instance;
    }

    this.config = config || new AppConfig();
    this.apiKey = this.config.openai.apiKey;
    this.defaultModel = this.config.openai.model;
    
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });

    // Store singleton instance
    OpenAIService.instance = this;
    
    console.log(`✅ OpenAI Service initialized with model: ${this.defaultModel}`);
  }

  /**
   * Create a chat completion with consistent error handling
   * @param {Object} options - OpenAI chat completion options
   * @returns {Promise<Object>} - OpenAI response
   */
  async createChatCompletion(options) {
    try {
              const defaultOptions = {
          model: this.defaultModel,
          temperature: this.config.openai.temperature,
          top_p: this.config.openai.topP,
          frequency_penalty: this.config.openai.frequencyPenalty,
          max_tokens: this.config.openai.maxTokens.invoice, // Default to invoice tokens
          ...options
        };

      const completion = await this.client.chat.completions.create(defaultOptions);
      return {
        success: true,
        content: completion.choices[0].message.content,
        usage: completion.usage,
        model: completion.model
      };
    } catch (error) {
      console.error("OpenAI API Error:", error);
      return {
        success: false,
        error: error.message,
        type: error.type || 'unknown_error'
      };
    }
  }

  /**
   * Parse JSON response with improved error handling
   * @param {string} response - Raw AI response
   * @param {boolean} returnWrapper - Whether to return success wrapper
   * @returns {Object} - Parsed JSON or error object
   */
  parseJSONResponse(response, returnWrapper = false) {
    try {
      // Clean the response - remove markdown code blocks and extra whitespace
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      
      // Parse JSON
      const parsed = JSON.parse(cleanedResponse);
      
      if (returnWrapper) {
        return {
          success: true,
          data: parsed
        };
      }
      
      return parsed;
    } catch (error) {
      console.error("JSON Parsing Error:", error);
      console.error("Raw response:", response.substring(0, 500) + "...");
      
      if (returnWrapper) {
        return {
          success: false,
          error: `Failed to parse JSON response: ${error.message}`,
          rawResponse: response.substring(0, 500)
        };
      }
      
      throw new Error(`Failed to parse JSON response: ${error.message}`);
    }
  }

  /**
   * Get the current model being used
   * @returns {string} - Model name
   */
  getModel() {
    return this.defaultModel;
  }

  /**
   * Set a different model for specific operations
   * @param {string} model - Model name
   */
  setModel(model) {
    this.defaultModel = model;
    console.log(`🔄 OpenAI model changed to: ${model}`);
  }

  /**
   * Get token limit for specific operation type
   * @param {string} operationType - Type of operation (invoice, validation, extraction, etc.)
   * @returns {number} - Token limit
   */
  getTokenLimit(operationType) {
    return this.config.openai.maxTokens[operationType] || this.config.openai.maxTokens.invoice;
  }

  /**
   * Health check for the OpenAI service
   * @returns {Promise<boolean>} - Service health status
   */
  async healthCheck() {
    try {
      const response = await this.createChatCompletion({
        messages: [
          { role: "user", content: "Return only the word 'OK'" }
        ],
        max_tokens: 10
      });
      
      return response.success && response.content.trim().toLowerCase().includes('ok');
    } catch (error) {
      console.error("OpenAI health check failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export default OpenAIService;