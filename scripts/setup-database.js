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

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...');

  // Create Supabase client with service key for admin operations
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
    // Test connection
    console.log('🔗 Testing database connection...');
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    if (error) throw error;
    console.log('✅ Database connection successful');

    // Read SQL schema file
    const schemaPath = path.join(__dirname, '..', 'database-schema.sql');
    console.log('📖 Reading schema file...');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n📋 Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          // Check if it's a "already exists" error, which is okay
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key') ||
              error.message.includes('relation') && error.message.includes('already exists')) {
            console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
            skipCount++;
          } else {
            console.error(`❌ Error executing statement: ${error.message}`);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
            throw error;
          }
        } else {
          console.log(`✅ Success: ${statement.substring(0, 50)}...`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Failed to execute: ${statement.substring(0, 50)}...`);
        throw err;
      }
    }

    console.log(`\n🎉 Database setup completed!`);
    console.log(`✅ Successfully executed: ${successCount} statements`);
    console.log(`⚠️  Skipped (already exists): ${skipCount} statements`);

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'business_settings', 
        'customers', 
        'products', 
        'invoices', 
        'orders', 
        'order_items', 
        'payment_methods', 
        'access_logs'
      ]);

    if (tablesError) throw tablesError;

    console.log(`📊 Found ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    if (tables.length >= 8) {
      console.log('✅ All tables created successfully!');
    } else {
      console.log('⚠️  Some tables may be missing. Please check the logs above.');
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }

  console.log('\n🏁 Database setup process completed.');
}

// Alternative method using direct SQL execution if rpc doesn't work
async function setupDatabaseDirect() {
  console.log('🚀 Setting up Supabase database (direct method)...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Create tables one by one using direct queries
    const tables = [
      {
        name: 'business_settings',
        sql: `
          CREATE TABLE IF NOT EXISTS business_settings (
            id SERIAL PRIMARY KEY,
            name TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            website TEXT,
            tax_id TEXT,
            tax_enabled BOOLEAN DEFAULT false,
            tax_rate DECIMAL(5,2) DEFAULT 0,
            tax_name TEXT DEFAULT 'PPN',
            tax_description TEXT,
            hide_business_name BOOLEAN DEFAULT false,
            business_code TEXT,
            logo_url TEXT,
            logo_filename TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `
      },
      {
        name: 'customers',
        sql: `
          CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            name TEXT,
            email TEXT UNIQUE,
            phone TEXT,
            address TEXT,
            source_invoice_id INTEGER,
            source_invoice_number TEXT,
            first_invoice_date TIMESTAMP WITH TIME ZONE,
            last_invoice_date TIMESTAMP WITH TIME ZONE,
            invoice_count INTEGER DEFAULT 0,
            total_spent DECIMAL(15,2) DEFAULT 0,
            extraction_method TEXT DEFAULT 'manual',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `
      }
      // Add more tables as needed...
    ];

    for (const table of tables) {
      console.log(`📋 Creating table: ${table.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: table.sql });
      
      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Error creating ${table.name}:`, error.message);
      } else {
        console.log(`✅ Table ${table.name} ready`);
      }
    }

  } catch (error) {
    console.error('❌ Direct database setup failed:', error.message);
    console.log('\n📝 Please manually run the database-schema.sql file in your Supabase SQL editor');
    console.log('   1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql');
    console.log('   2. Copy the contents of database-schema.sql');
    console.log('   3. Paste and execute in the SQL editor');
  }
}

// Run the setup
setupDatabase().catch(() => {
  console.log('\n🔄 Trying alternative setup method...');
  setupDatabaseDirect();
});