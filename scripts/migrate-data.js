#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function migrateData() {
  console.log('🚀 Starting data migration from JSON to Supabase...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // Read existing JSON database
    const databasePath = path.join(__dirname, '..', 'database.json');
    
    if (!fs.existsSync(databasePath)) {
      console.log('📄 No existing database.json found. Starting with empty database.');
      return;
    }

    console.log('📖 Reading existing database.json...');
    const jsonData = JSON.parse(fs.readFileSync(databasePath, 'utf8'));

    // Migrate business settings
    if (jsonData.business_settings) {
      console.log('🏢 Migrating business settings...');
      const settings = jsonData.business_settings;
      
      const { error: settingsError } = await supabase
        .from('business_settings')
        .upsert({
          name: settings.name,
          email: settings.email,
          phone: settings.phone,
          address: settings.address,
          website: settings.website,
          tax_id: settings.taxId,
          tax_enabled: settings.taxEnabled,
          tax_rate: settings.taxRate,
          tax_name: settings.taxName,
          tax_description: settings.taxDescription,
          hide_business_name: settings.hideBusinessName,
          business_code: settings.businessCode,
          logo_url: settings.logoUrl,
          logo_filename: settings.logoFilename
        }, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (settingsError) {
        console.error('❌ Failed to migrate business settings:', settingsError);
      } else {
        console.log('✅ Business settings migrated successfully');
      }
    }

    // Migrate customers
    if (jsonData.customers && jsonData.customers.length > 0) {
      console.log(`👥 Migrating ${jsonData.customers.length} customers...`);
      
      for (const customer of jsonData.customers) {
        const { error: customerError } = await supabase
          .from('customers')
          .upsert({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            source_invoice_id: customer.source_invoice_id,
            source_invoice_number: customer.source_invoice_number,
            first_invoice_date: customer.first_invoice_date,
            last_invoice_date: customer.last_invoice_date,
            invoice_count: customer.invoice_count || 0,
            total_spent: customer.total_spent || 0,
            extraction_method: customer.extraction_method || 'manual',
            created_at: customer.created_at,
            updated_at: customer.updated_at
          }, { 
            onConflict: 'email',
            ignoreDuplicates: false 
          });

        if (customerError) {
          console.error(`❌ Failed to migrate customer ${customer.email}:`, customerError);
        }
      }
      console.log('✅ Customers migrated successfully');
    }

    // Migrate products
    if (jsonData.products && jsonData.products.length > 0) {
      console.log(`📦 Migrating ${jsonData.products.length} products...`);
      
      for (const product of jsonData.products) {
        const { error: productError } = await supabase
          .from('products')
          .upsert({
            sku: product.sku,
            name: product.name,
            description: product.description,
            category: product.category,
            unit_price: product.unit_price,
            cost_price: product.cost_price || 0,
            stock_quantity: product.stock_quantity || 0,
            min_stock_level: product.min_stock_level || 0,
            is_active: product.is_active !== undefined ? product.is_active : true,
            tax_rate: product.tax_rate || 0,
            dimensions: product.dimensions,
            weight: product.weight,
            image_url: product.image_url,
            created_at: product.created_at,
            updated_at: product.updated_at
          }, { 
            onConflict: 'sku',
            ignoreDuplicates: false 
          });

        if (productError) {
          console.error(`❌ Failed to migrate product ${product.sku}:`, productError);
        }
      }
      console.log('✅ Products migrated successfully');
    }

    // Migrate invoices
    if (jsonData.invoices && jsonData.invoices.length > 0) {
      console.log(`📄 Migrating ${jsonData.invoices.length} invoices...`);
      
      for (const invoice of jsonData.invoices) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .upsert({
            invoice_number: invoice.invoice_number,
            customer_name: invoice.customer_name,
            customer_email: invoice.customer_email,
            customer_phone: invoice.customer_phone,
            customer_address: invoice.customer_address,
            merchant_name: invoice.merchant_name,
            merchant_address: invoice.merchant_address,
            merchant_phone: invoice.merchant_phone,
            merchant_email: invoice.merchant_email,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            original_due_date: invoice.original_due_date,
            status: invoice.status || 'draft',
            payment_stage: invoice.payment_stage || 'full_payment',
            payment_status: invoice.payment_status || 'pending',
            subtotal: invoice.subtotal,
            tax_amount: invoice.tax_amount,
            shipping_cost: invoice.shipping_cost || 0,
            discount: invoice.discount || 0,
            discount_amount: invoice.discount_amount || 0,
            grand_total: invoice.grand_total,
            currency: invoice.currency || 'IDR',
            payment_terms: invoice.payment_terms || 'Net 30',
            notes: invoice.notes,
            items_json: typeof invoice.items_json === 'string' ? JSON.parse(invoice.items_json || '[]') : invoice.items_json,
            metadata_json: typeof invoice.metadata_json === 'string' ? JSON.parse(invoice.metadata_json || '{}') : invoice.metadata_json,
            payment_schedule_json: typeof invoice.payment_schedule_json === 'string' ? JSON.parse(invoice.payment_schedule_json || 'null') : invoice.payment_schedule_json,
            notes_json: typeof invoice.notes_json === 'string' ? JSON.parse(invoice.notes_json || '{}') : invoice.notes_json,
            calculations_json: typeof invoice.calculations_json === 'string' ? JSON.parse(invoice.calculations_json || '{}') : invoice.calculations_json,
            customer_token: invoice.customer_token,
            created_at: invoice.created_at,
            updated_at: invoice.updated_at
          }, { 
            onConflict: 'invoice_number',
            ignoreDuplicates: false 
          });

        if (invoiceError) {
          console.error(`❌ Failed to migrate invoice ${invoice.invoice_number}:`, invoiceError);
        }
      }
      console.log('✅ Invoices migrated successfully');
    }

    // Migrate orders
    if (jsonData.orders && jsonData.orders.length > 0) {
      console.log(`📋 Migrating ${jsonData.orders.length} orders...`);
      
      for (const order of jsonData.orders) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .upsert({
            order_number: order.order_number,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            status: order.status || 'pending',
            order_date: order.order_date,
            shipping_address: order.shipping_address,
            billing_address: order.billing_address,
            payment_method: order.payment_method,
            payment_status: order.payment_status || 'pending',
            subtotal: order.subtotal,
            tax_amount: order.tax_amount || 0,
            shipping_cost: order.shipping_cost || 0,
            discount: order.discount || 0,
            total_amount: order.total_amount,
            notes: order.notes,
            tracking_number: order.tracking_number,
            shipped_date: order.shipped_date,
            delivered_date: order.delivered_date,
            source_invoice_id: order.source_invoice_id,
            source_invoice_number: order.source_invoice_number,
            created_at: order.created_at,
            updated_at: order.updated_at
          }, { 
            onConflict: 'order_number',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (orderError) {
          console.error(`❌ Failed to migrate order ${order.order_number}:`, orderError);
          continue;
        }

        // Migrate order items
        if (jsonData.order_items && jsonData.order_items.length > 0) {
          const orderItems = jsonData.order_items.filter(item => item.order_id === order.id);
          
          for (const item of orderItems) {
            const { error: itemError } = await supabase
              .from('order_items')
              .upsert({
                order_id: orderData.id,
                product_id: item.product_id,
                product_name: item.product_name,
                sku: item.sku,
                quantity: item.quantity,
                unit_price: item.unit_price,
                line_total: item.line_total
              });

            if (itemError) {
              console.error(`❌ Failed to migrate order item for order ${order.order_number}:`, itemError);
            }
          }
        }
      }
      console.log('✅ Orders and order items migrated successfully');
    }

    console.log('🎉 Data migration completed successfully!');
    
    // Create backup of original file
    const backupPath = path.join(__dirname, '..', `database-backup-${Date.now()}.json`);
    fs.copyFileSync(databasePath, backupPath);
    console.log(`📋 Original database backed up to: ${backupPath}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateData();