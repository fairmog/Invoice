#!/usr/bin/env node

/**
 * Test Product Catalog Lookup
 * 
 * This test investigates if the AI should be looking up prices from the product catalog
 * when processing user messages like "lolly 13pcs" (without explicit price)
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testProductCatalogLookup() {
  console.log('🔍 Testing Product Catalog Price Lookup');
  console.log('=' .repeat(60));

  try {
    // First, let's check what products are in the catalog
    console.log('📋 Step 1: Check current product catalog...');
    
    const catalogResponse = await fetch(`${BASE_URL}/api/products`);
    const catalogData = await catalogResponse.json();
    
    if (catalogData.success && catalogData.products.length > 0) {
      console.log(`✅ Found ${catalogData.products.length} products in catalog:`);
      catalogData.products.slice(0, 5).forEach(product => {
        console.log(`   - ${product.name} (SKU: ${product.sku}) - Rp ${product.unit_price}`);
      });
      
      if (catalogData.products.length > 5) {
        console.log(`   ... and ${catalogData.products.length - 5} more products`);
      }
      
      // Look for products that might match "lolly"
      const matchingProducts = catalogData.products.filter(product => 
        product.name.toLowerCase().includes('lolly') ||
        product.sku.toLowerCase().includes('lolly') ||
        product.description?.toLowerCase().includes('lolly')
      );
      
      if (matchingProducts.length > 0) {
        console.log('\n🎯 Found potential matches for "lolly":');
        matchingProducts.forEach(product => {
          console.log(`   - ${product.name} (SKU: ${product.sku}) - Rp ${product.unit_price}`);
        });
      } else {
        console.log('\n❓ No products found matching "lolly" in catalog');
      }
      
    } else {
      console.log('❌ No products found in catalog or catalog failed to load');
      if (catalogData.error) {
        console.log('   Error:', catalogData.error);
      }
    }

    // Test the AI processing with a message that has a product name but no price
    console.log('\n📝 Step 2: Test AI processing with product name only...');
    
    const testMessage = `lolly 13pcs
christy
jalan mimosa 30 no 2 jakarta utara
087882880070
famrog@gmail.com`;

    const businessProfile = {
      name: "Bevelient",
      email: "bevelient@gmail.com", 
      phone: "087882880070",
      address: "Jl Duta Harapan Indah Blok 14 no 23"
    };

    console.log('Message:', testMessage.split('\\n')[0] + '...');
    
    const response = await fetch(`${BASE_URL}/api/preview-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage, businessProfile })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('\n📊 AI PROCESSING RESULTS:');
      
      if (data.invoice && data.invoice.items && data.invoice.items.length > 0) {
        const item = data.invoice.items[0];
        console.log('\nExtracted Item:');
        console.log(`  - Product Name: "${item.productName}"`);
        console.log(`  - Quantity: ${item.quantity}`);
        console.log(`  - Unit Price: Rp ${item.unitPrice}`);
        console.log(`  - Line Total: Rp ${item.lineTotal}`);
        
        // Check if there are any fields indicating catalog matching
        if (item.matchedFromCatalog !== undefined) {
          console.log(`  - Matched from Catalog: ${item.matchedFromCatalog}`);
        }
        if (item.catalogId) {
          console.log(`  - Catalog ID: ${item.catalogId}`);
        }
        if (item.sku) {
          console.log(`  - SKU: ${item.sku}`);
        }
        
        console.log('\n🔍 ANALYSIS:');
        
        if (item.unitPrice === 0) {
          console.log('❗ Unit price is 0 - investigating possible causes:');
          console.log('\n1. 🤔 AI didn\'t find price in user message (expected)');
          console.log('2. 🔍 AI didn\'t match product to catalog (investigating...)');
          console.log('3. 🏪 AI matched to catalog but catalog price is 0');
          console.log('4. 📋 Catalog wasn\'t provided to AI (technical issue)');
          
          // Check if this should have matched a catalog product
          if (catalogData.success && catalogData.products.length > 0) {
            const potentialMatches = catalogData.products.filter(product => 
              product.name.toLowerCase().includes('lolly') ||
              product.name.toLowerCase().includes(item.productName.toLowerCase().split(' ')[0])
            );
            
            if (potentialMatches.length > 0) {
              console.log('\n💡 FOUND POTENTIAL CATALOG MATCHES:');
              potentialMatches.forEach(product => {
                console.log(`   - ${product.name} - Rp ${product.unit_price}`);
              });
              console.log('\n🚨 ISSUE: AI should have matched product to catalog and used catalog price!');
              console.log('   This suggests the product catalog lookup is NOT working properly.');
            } else {
              console.log('\n✅ No matching products in catalog - zero price is expected');
            }
          }
        } else {
          console.log('✅ Unit price found - either from user message or catalog lookup');
        }
      }
      
      console.log('\nFull calculations:', data.invoice.calculations);
      
    } else {
      console.log('❌ AI processing failed:', data.error);
    }
    
    console.log('\n🎯 CONCLUSION:');
    console.log('=' .repeat(60));
    
    if (catalogData.success && catalogData.products.length > 0) {
      console.log('✅ Product catalog is loaded with products');
      console.log('🔍 Need to verify if AI is using catalog for price lookup');
      console.log('📋 Expected behavior: AI should match "lolly" to catalog products');
      console.log('💰 Expected result: Use catalog price when user doesn\'t specify price');
    } else {
      console.log('❌ Product catalog is empty or not loading');
      console.log('🔧 This could explain why all prices are 0');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testProductCatalogLookup().catch(console.error);