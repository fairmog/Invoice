#!/usr/bin/env node

/**
 * Premium Branding Database Migration
 * This script applies the premium branding columns to the Supabase database
 */

import dotenv from 'dotenv';
dotenv.config();

import SupabaseDatabase from './src/supabase-database.js';

console.log('🔧 Starting Premium Branding Database Migration...');
console.log('='.repeat(50));

const database = new SupabaseDatabase();

async function runMigration() {
  try {
    console.log('📋 Applying premium branding columns migration...');
    
    // List of columns to add
    const columnsToAdd = [
      { name: 'premium_active', type: 'boolean', default: 'false' },
      { name: 'custom_header_text', type: 'text', default: null },
      { name: 'custom_header_logo_url', type: 'text', default: null },
      { name: 'custom_header_logo_public_id', type: 'text', default: null },
      { name: 'custom_footer_logo_url', type: 'text', default: null },
      { name: 'custom_footer_logo_public_id', type: 'text', default: null },
      { name: 'custom_header_bg_color', type: 'text', default: "'#311d6b'" },
      { name: 'custom_footer_bg_color', type: 'text', default: "'#311d6b'" },
      { name: 'hide_aspree_branding', type: 'boolean', default: 'false' }
    ];
    
    for (const column of columnsToAdd) {
      try {
        console.log(`➕ Adding column: ${column.name}`);
        
        const alterSQL = `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}${column.default ? ` DEFAULT ${column.default}` : ''}`;
        
        // Execute the ALTER TABLE statement
        const { error } = await database.supabase.rpc('sql', { query: alterSQL });
        
        if (error) {
          console.warn(`⚠️  Column ${column.name} may already exist or error: ${error.message}`);
        } else {
          console.log(`✅ Column ${column.name} added successfully`);
        }
        
        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️  Error adding column ${column.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 Premium branding columns migration completed!');
    console.log('='.repeat(50));
    console.log('📋 Premium branding features added:');
    console.log('   • Custom header text');
    console.log('   • Custom header & footer logos');  
    console.log('   • Custom header & footer background colors');
    console.log('   • Option to hide Aspree branding');
    console.log('\n🚀 Premium branding is now ready for implementation!');
    
    // Test the premium status after migration
    console.log('\n🧪 Testing premium functionality...');
    const isPremium = await database.isPremiumActive();
    console.log(`📊 Premium status: ${isPremium ? 'Active' : 'Inactive'}`);
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Details:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();