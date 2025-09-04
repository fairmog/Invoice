#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function addMerchantsTable() {
  console.log('🚀 Adding merchants table to Supabase...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // SQL to create merchants table
  const merchantsTableSQL = `
    -- Create merchants table if not exists
    CREATE TABLE IF NOT EXISTS merchants (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      business_name TEXT,
      full_name TEXT,
      phone TEXT,
      address TEXT,
      website TEXT,
      status TEXT DEFAULT 'active',
      email_verified BOOLEAN DEFAULT false,
      email_verification_token TEXT,
      reset_token TEXT,
      reset_token_expires TIMESTAMP WITH TIME ZONE,
      last_login TIMESTAMP WITH TIME ZONE,
      login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP WITH TIME ZONE,
      subscription_plan TEXT DEFAULT 'free',
      subscription_expires TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
    CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
    CREATE INDEX IF NOT EXISTS idx_merchants_reset_token ON merchants(reset_token);

    -- Create updated_at trigger
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Create trigger for merchants
    DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
    CREATE TRIGGER update_merchants_updated_at 
      BEFORE UPDATE ON merchants 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    console.log('📋 Creating merchants table and indexes...');

    // Test if we can query any table first
    const { data: testData, error: testError } = await supabase
      .from('business_settings')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Supabase connection test failed:', testError.message);
      return;
    }

    console.log('✅ Supabase connection successful');

    // Check if merchants table exists
    const { data: existingMerchants, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .limit(1);

    if (!merchantError) {
      console.log('✅ Merchants table already exists!');
      return;
    }

    if (merchantError.code !== 'PGRST116') {
      console.log('📋 Merchants table does not exist. Need to create it manually.');
      console.log('\n🔧 MANUAL SETUP REQUIRED:');
      console.log('1. Go to: https://supabase.com/dashboard/project/vcqejlrfyjisqgrqebyl/sql');
      console.log('2. Copy and paste this SQL:');
      console.log('---');
      console.log(merchantsTableSQL);
      console.log('---');
      console.log('3. Click RUN to create the merchants table');
      console.log('4. Then try registering again');
      return;
    }

    console.log('✅ Merchants table setup completed');

  } catch (error) {
    console.error('❌ Failed to setup merchants table:', error.message);
    console.log('\n📝 MANUAL SETUP REQUIRED:');
    console.log('Go to your Supabase SQL editor and run the merchants table SQL');
  }
}

// Run the setup
addMerchantsTable();
