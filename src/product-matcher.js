import OpenAIService from './openai-service.js';
import OptimizedPrompts from './optimized-prompts.js';
import { IndonesianPrompts } from './indonesian-prompts.js';

class ProductMatcher {
  constructor(openaiService = null) {
    this.openai = openaiService || new OpenAIService();
  }

  async matchProducts(extractedItems, merchantCatalog) {
    const prompt = OptimizedPrompts.matchProducts(extractedItems, merchantCatalog);

    const response = await this.openai.createChatCompletion({
      messages: [
        {
          role: "system",
          content: "Match products with catalog. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.openai.getTokenLimit('matching')
    });

    if (!response.success) {
      throw new Error(`Product matching failed: ${response.error}`);
    }

    return this.openai.parseJSONResponse(response.content);
  }

  async suggestCatalogUpdates(unmatchedItems, merchantCatalog) {
    const prompt = `Analyze these unmatched items and suggest catalog updates:

Unmatched Items:
${JSON.stringify(unmatchedItems, null, 2)}

Current Catalog:
${JSON.stringify(merchantCatalog, null, 2)}

Suggest improvements in this JSON format:
{
  "newProductSuggestions": [
    {
      "suggestedProduct": {
        "name": "suggested product name",
        "description": "suggested description",
        "sku": "suggested SKU",
        "category": "suggested category",
        "estimatedPrice": number,
        "tags": ["tag1", "tag2"]
      },
      "basedOnItems": [array of unmatched items that led to this suggestion],
      "confidence": 0.0-1.0
    }
  ],
  "catalogImprovements": [
    {
      "existingProductId": "product ID to improve",
      "improvements": {
        "alternativeNames": ["alternative name 1", "alternative name 2"],
        "betterDescription": "improved description",
        "additionalTags": ["tag1", "tag2"]
      }
    }
  ]
}

Rules:
- Suggest realistic product additions
- Consider product variations and bundles
- Recommend better product descriptions
- Add searchable tags and keywords
- Group similar unmatched items into product variants`;

    const response = await this.openai.createChatCompletion({
      messages: [
        {
          role: "system",
          content: "You are a catalog optimization assistant. Suggest catalog improvements and return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.openai.getTokenLimit('matching')
    });

    if (!response.success) {
      throw new Error(`Catalog updates suggestion failed: ${response.error}`);
    }

    return this.openai.parseJSONResponse(response.content);
  }
}

export default ProductMatcher;