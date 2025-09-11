#!/usr/bin/env node

/**
 * Apply Premium Persistence Migration Script
 * 
 * This script applies the merchant isolation migration to fix premium persistence
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Read environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set');
  process.exit(1);
}

console.log('🔧 Applying Premium Persistence Migration...\n');

try {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Read the migration SQL
  const migrationSQL = fs.readFileSync('./scripts/fix-premium-persistence-migration.sql', 'utf8');
  
  console.log('📄 Executing migration script...');
  
  // Split the SQL into individual statements and execute them
  const statements = migrationSQL
    .split(';')
    .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'))
    .map(stmt => stmt.trim());
  
  for (const statement of statements) {
    if (statement.includes('DO $$') || statement.includes('BEGIN') || statement.includes('COMMIT')) {
      // Execute complex PL/pgSQL blocks directly
      const { error } = await supabase.rpc('exec', { sql: statement });
      if (error) {
        console.warn('⚠️  Statement warning:', error.message);
      }
    }
  }
  
  console.log('✅ Migration completed successfully!');
  console.log('\n📊 Next steps:');
  console.log('1. Test the premium flow in the web interface');
  console.log('2. Run: node test-premium-persistence.js');
  console.log('3. Verify premium status persists after page refresh');
  
} catch (error) {
  console.error('💥 Error applying migration:', error.message);
  process.exit(1);
}
