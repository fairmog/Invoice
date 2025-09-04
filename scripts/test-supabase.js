#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testSupabaseConnection() {
  console.log('🚀 Testing Supabase connection...');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Service Key:', process.env.SUPABASE_SERVICE_KEY?.substring(0, 20) + '...');

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
    // Test with a simple query
    console.log('🔗 Testing basic connection...');
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('✅ Connection successful - table exists but is empty');
        return true;
      } else if (error.message.includes('relation "public.business_settings" does not exist')) {
        console.log('⚠️  Connection successful but tables need to be created');
        console.log('📝 Please manually create tables using the SQL below:');
        return false;
      } else {
        throw error;
      }
    } else {
      console.log('✅ Connection successful - found data:', data?.length || 0, 'rows');
      return true;
    }

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function createBasicTables() {
  console.log('\n📋 Creating basic tables...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const basicTable = `
    CREATE TABLE IF NOT EXISTS business_settings (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      logo_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  try {
    console.log('Creating business_settings table...');
    // We'll create tables manually since Supabase doesn't expose SQL execution via JS client
    console.log('\n📝 MANUAL SETUP REQUIRED:');
    console.log('1. Go to: https://supabase.com/dashboard/project/vcqejlrfyjisqgrqebyl/sql');
    console.log('2. Copy the contents of database-schema.sql');
    console.log('3. Paste and run in the SQL editor');
    console.log('4. Then run this test again');
    
  } catch (error) {
    console.error('❌ Table creation failed:', error.message);
  }
}

// Run test
testSupabaseConnection().then(success => {
  if (!success) {
    createBasicTables();
  }
});
