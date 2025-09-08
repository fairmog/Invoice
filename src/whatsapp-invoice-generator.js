import AIDataExtractor from './ai-extractor.js';
import ProductMatcher from './product-matcher.js';
import InvoiceGenerator from './invoice-generator.js';
import OpenAIService from './openai-service.js';

class WhatsAppInvoiceGenerator {
  constructor() {
    // Create single OpenAI service instance for all components
    this.openaiService = new OpenAIService();
    
    // Inject shared service into all components
    this.dataExtractor = new AIDataExtractor(this.openaiService);
    this.productMatcher = new ProductMatcher(this.openaiService);
    this.invoiceGenerator = new InvoiceGenerator(this.openaiService);
  }

  async processWhatsAppMessage(rawMessage, merchantConfig, shippingOptions = null, additionalNotes = null) {
    try {
      const startTime = Date.now();
      console.log("🔄 Processing WhatsApp message with parallel optimization...");
      
      // Step 1: Extract structured data from raw message (must be first)
      console.log("📊 Extracting customer and product data...");
      const extractedData = await this.dataExtractor.processCompleteOrder(
        rawMessage, 
        merchantConfig.catalog
      );
      
      if (extractedData.error) {
        throw new Error(`Data extraction failed: ${extractedData.error}`);
      }

      console.log(`⚡ Data extraction completed in ${Date.now() - startTime}ms`);

      // Step 2 & 3: Run product matching and invoice generation in parallel
      console.log("⚡ Running product matching and invoice generation in parallel...");
      const parallelStartTime = Date.now();
      
      const [matchingResults, invoiceResult] = await Promise.all([
        // Parallel Task 1: Match products with catalog
        this.productMatcher.matchProducts(extractedData.items, merchantConfig.catalog)
          .then(result => {
            console.log("🔍 Product matching completed");
            return result;
          }),
        
        // Parallel Task 2: Generate invoice with raw extracted data
        (() => {
          // DEBUG: Log the entire extracted data structure
          console.log('🔍 Full extractedData structure:', JSON.stringify(extractedData, null, 2));
          
          // Extract payment options from the extracted data
          const paymentOptions = {
            enablePaymentSchedule: extractedData.paymentSchedule?.enablePaymentSchedule || false,
            downPaymentPercentage: extractedData.paymentSchedule?.downPaymentPercentage || 30,
            downPaymentDays: 15, // default
            finalPaymentDays: 30, // default
            finalPaymentDate: extractedData.paymentSchedule?.finalPaymentDate || null
          };
          
          // DEBUG: Log extracted data for payment schedule
          console.log('🔍 extractedData.paymentSchedule:', JSON.stringify(extractedData.paymentSchedule));
          console.log('🔍 Payment options extracted:', JSON.stringify(paymentOptions, null, 2));
          
          // Log payment schedule detection
          if (paymentOptions.enablePaymentSchedule) {
            console.log(`💰 Payment schedule detected: ${paymentOptions.downPaymentPercentage}% down payment`);
            if (paymentOptions.finalPaymentDate) {
              console.log(`📅 Final payment date: ${paymentOptions.finalPaymentDate}`);
            }
          } else {
            console.log('💳 Standard payment (no down payment detected)');
          }

          // Calculate final payment days from date if provided
          if (paymentOptions.finalPaymentDate && paymentOptions.finalPaymentDate.trim()) {
            try {
              const finalDate = new Date(paymentOptions.finalPaymentDate);
              const today = new Date();
              const diffTime = finalDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays > 0) {
                paymentOptions.finalPaymentDays = diffDays;
              }
            } catch (e) {
              console.log('Could not parse final payment date, using default');
            }
          }

          return this.invoiceGenerator.generateInvoice(
            extractedData,
            merchantConfig,
            shippingOptions,
            additionalNotes,
            paymentOptions
          );
        })().then(result => {
          console.log("📄 Invoice generation completed");
          return result;
        })
      ]);

      console.log(`⚡ Parallel processing completed in ${Date.now() - parallelStartTime}ms`);

      // Check for errors from parallel operations
      if (matchingResults.error) {
        throw new Error(`Product matching failed: ${matchingResults.error}`);
      }
      if (invoiceResult.error) {
        throw new Error(`Invoice generation failed: ${invoiceResult.error}`);
      }

      // Step 4: Create enhanced order data with matched products (fast merge)
      const enhancedOrderData = {
        ...extractedData,
        items: matchingResults.matchedItems.map(item => item.finalItem),
        unmatchedItems: matchingResults.unmatchedItems,
        matchingConfidence: this.calculateAverageConfidence(matchingResults.matchedItems)
      };

      // Step 5: Validate invoice (can be done in background if needed)
      console.log("✅ Validating invoice...");
      const validationStartTime = Date.now();
      const validation = await this.invoiceGenerator.validateInvoice(invoiceResult.invoice);
      console.log(`✅ Validation completed in ${Date.now() - validationStartTime}ms`);

      // Step 6: Return complete result with performance metrics
      const totalTime = Date.now() - startTime;
      console.log(`🎯 Total processing completed in ${totalTime}ms (${Math.round(totalTime/1000)}s)`);
      
      return {
        success: true,
        invoice: invoiceResult.invoice,
        processingDetails: {
          extractedData,
          matchingResults,
          validation,
          processingTime: new Date().toISOString(),
          performanceMetrics: {
            totalTimeMs: totalTime,
            extractionTimeMs: parallelStartTime - startTime,
            parallelTimeMs: Date.now() - parallelStartTime - (Date.now() - validationStartTime),
            validationTimeMs: Date.now() - validationStartTime,
            optimizationUsed: 'parallel_processing_v1'
          }
        },
        recommendations: {
          catalogUpdates: matchingResults.newProducts,
          unmatchedItems: matchingResults.unmatchedItems,
          confidenceScore: enhancedOrderData.matchingConfidence
        }
      };

    } catch (error) {
      console.error("❌ Error processing WhatsApp message:", error);
      return {
        success: false,
        error: error.message,
        processingTime: new Date().toISOString()
      };
    }
  }

  async batchProcessMessages(messages, merchantConfig, defaultShipping = null, concurrency = 2) {
    const batchStartTime = Date.now();
    console.log(`🚀 Starting batch processing of ${messages.length} messages with concurrency: ${concurrency}`);
    
    const results = [];
    const batches = [];
    
    // Split messages into batches for parallel processing
    for (let i = 0; i < messages.length; i += concurrency) {
      batches.push(messages.slice(i, i + concurrency));
    }
    
    // Process each batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n⚡ Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} messages)`);
      
      const batchPromises = batch.map(async (message, messageIndex) => {
        const globalIndex = batchIndex * concurrency + messageIndex;
        const messageId = message.id || `msg_${globalIndex + 1}`;
        
        try {
          console.log(`🔄 Processing message ${globalIndex + 1}/${messages.length}: ${messageId}`);
          
          const result = await this.processWhatsAppMessage(
            message.content,
            merchantConfig,
            message.shippingOptions || defaultShipping,
            message.notes
          );
          
          return {
            messageId,
            result,
            processed: true
          };
          
        } catch (error) {
          console.error(`❌ Error processing message ${messageId}:`, error.message);
          return {
            messageId,
            result: {
              success: false,
              error: error.message
            },
            processed: true
          };
        }
      });
      
      // Wait for all messages in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        console.log(`⏸️ Batch ${batchIndex + 1} completed, waiting 2s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const totalBatchTime = Date.now() - batchStartTime;
    const successfulResults = results.filter(r => r.result.success);
    const failedResults = results.filter(r => !r.result.success);
    
    console.log(`🎯 Batch processing completed in ${totalBatchTime}ms (${Math.round(totalBatchTime/1000)}s)`);
    console.log(`✅ Success: ${successfulResults.length}/${messages.length}, ❌ Failed: ${failedResults.length}/${messages.length}`);
    
    return {
      totalProcessed: messages.length,
      successful: successfulResults.length,
      failed: failedResults.length,
      results,
      performanceMetrics: {
        totalBatchTimeMs: totalBatchTime,
        averageTimePerMessageMs: totalBatchTime / messages.length,
        concurrency: concurrency,
        batchCount: batches.length,
        optimizationUsed: 'parallel_batch_processing_v1'
      }
    };
  }

  calculateAverageConfidence(matchedItems) {
    if (!matchedItems.length) return 0;
    
    const totalConfidence = matchedItems.reduce((sum, item) => sum + (item.confidence || 0), 0);
    return totalConfidence / matchedItems.length;
  }

  async suggestCatalogImprovements(processingResults) {
    const allUnmatchedItems = processingResults.flatMap(result => 
      result.result.recommendations?.unmatchedItems || []
    );
    
    if (allUnmatchedItems.length === 0) {
      return { suggestions: [], message: "No catalog improvements needed" };
    }

    return await this.productMatcher.suggestCatalogUpdates(
      allUnmatchedItems,
      processingResults[0].merchantConfig?.catalog
    );
  }

  generateProcessingReport(batchResults) {
    const report = {
      summary: {
        totalMessages: batchResults.totalProcessed,
        successfullyProcessed: batchResults.successful,
        failed: batchResults.failed,
        successRate: (batchResults.successful / batchResults.totalProcessed) * 100
      },
      insights: {
        averageConfidence: 0,
        commonUnmatchedProducts: [],
        totalRevenue: 0,
        customerCount: 0
      },
      recommendations: []
    };

    const successfulResults = batchResults.results.filter(r => r.result.success);
    
    if (successfulResults.length > 0) {
      // Calculate average confidence
      const confidenceScores = successfulResults.map(r => r.result.recommendations.confidenceScore);
      report.insights.averageConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
      
      // Calculate total revenue
      report.insights.totalRevenue = successfulResults.reduce((total, r) => 
        total + (r.result.invoice.calculations.grandTotal || 0), 0
      );
      
      // Count unique customers
      const uniqueCustomers = new Set(successfulResults.map(r => r.result.invoice.customer.email));
      report.insights.customerCount = uniqueCustomers.size;
      
      // Identify common unmatched products
      const unmatchedProducts = successfulResults.flatMap(r => 
        r.result.recommendations.unmatchedItems || []
      );
      
      const productFrequency = {};
      unmatchedProducts.forEach(product => {
        const key = product.productName || product.description;
        productFrequency[key] = (productFrequency[key] || 0) + 1;
      });
      
      report.insights.commonUnmatchedProducts = Object.entries(productFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([product, count]) => ({ product, count }));
    }

    return report;
  }
}

export default WhatsAppInvoiceGenerator;