/**
 * Database Schema Diagnostic Script
 * Checks for missing columns and constraints that are causing the current errors
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function diagnoseDatabaseIssues() {
    console.log('🔍 Starting database schema diagnosis...\n');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing Supabase environment variables');
        console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your .env file');
        process.exit(1);
    }

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
        // Check business_settings table structure
        console.log('📋 Checking business_settings table...');
        const { data: businessSettingsColumns, error: bsError } = await supabase
            .rpc('get_table_columns', { table_name: 'business_settings' });

        if (bsError) {
            console.log('⚠️  Could not get business_settings columns, trying alternative method...');
            // Try to select from table to see what columns exist
            const { data, error } = await supabase
                .from('business_settings')
                .select('*')
                .limit(1);
            
            if (error) {
                console.error('❌ Error accessing business_settings:', error.message);
            } else {
                console.log('✅ business_settings table exists and is accessible');
                if (data && data.length > 0) {
                    const columns = Object.keys(data[0]);
                    console.log('📝 Available columns:', columns.join(', '));
                    
                    if (!columns.includes('terms_conditions')) {
                        console.log('❌ MISSING: terms_conditions column not found');
                    } else {
                        console.log('✅ terms_conditions column exists');
                    }
                } else {
                    console.log('📝 Table exists but has no data - cannot determine column structure');
                }
            }
        } else if (businessSettingsColumns) {
            console.log('✅ business_settings columns retrieved');
            const hasTermsConditions = businessSettingsColumns.some(col => col.column_name === 'terms_conditions');
            if (hasTermsConditions) {
                console.log('✅ terms_conditions column exists');
            } else {
                console.log('❌ MISSING: terms_conditions column not found');
            }
        }

        console.log('\n💳 Checking payment_methods table...');
        
        // Check payment_methods table structure and constraints
        const { data: paymentMethodsData, error: pmError } = await supabase
            .from('payment_methods')
            .select('*');

        if (pmError) {
            console.error('❌ Error accessing payment_methods:', pmError.message);
        } else {
            console.log('✅ payment_methods table exists and is accessible');
            console.log(`📊 Found ${paymentMethodsData.length} payment method records`);
            
            // Check for duplicate method_type entries
            const methodTypes = paymentMethodsData.map(pm => pm.method_type);
            const duplicates = methodTypes.filter((item, index) => methodTypes.indexOf(item) !== index);
            
            if (duplicates.length > 0) {
                console.log('⚠️  DUPLICATE method_type values found:', [...new Set(duplicates)]);
                console.log('🔧 These need to be resolved before adding UNIQUE constraint');
            } else {
                console.log('✅ No duplicate method_type values found');
            }
            
            // List current method types
            const uniqueMethodTypes = [...new Set(methodTypes)];
            console.log('📝 Current method types:', uniqueMethodTypes.join(', '));
        }

        // Check for unique constraints on payment_methods
        console.log('\n🔐 Checking constraints on payment_methods...');
        const { data: constraints, error: constraintError } = await supabase
            .rpc('get_table_constraints', { table_name: 'payment_methods' });

        if (constraintError) {
            console.log('⚠️  Could not get constraint information:', constraintError.message);
            console.log('🔧 Will assume UNIQUE constraint on method_type is missing');
        } else if (constraints) {
            const hasUniqueConstraint = constraints.some(c => 
                c.constraint_type === 'UNIQUE' && c.column_name === 'method_type'
            );
            
            if (hasUniqueConstraint) {
                console.log('✅ UNIQUE constraint on method_type exists');
            } else {
                console.log('❌ MISSING: UNIQUE constraint on method_type not found');
                console.log('🔧 This is required for upsert operations to work');
            }
        }

        console.log('\n📋 DIAGNOSIS SUMMARY:');
        console.log('====================');
        console.log('1. Check if terms_conditions column exists in business_settings');
        console.log('2. Check if UNIQUE constraint exists on payment_methods.method_type');
        console.log('3. Look for any duplicate method_type values that need cleanup');
        console.log('\n✅ Diagnosis complete. Review the output above for issues to fix.');

    } catch (error) {
        console.error('💥 Diagnosis failed:', error.message);
        console.error(error.stack);
    }
}

// Helper function to create RPC functions if they don't exist
async function createHelperFunctions(supabase) {
    console.log('🔧 Creating helper RPC functions...');
    
    const createColumnsFunctionSQL = `
        CREATE OR REPLACE FUNCTION get_table_columns(table_name TEXT)
        RETURNS TABLE (
            column_name TEXT,
            data_type TEXT,
            is_nullable TEXT,
            column_default TEXT
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                c.column_name::TEXT,
                c.data_type::TEXT,
                c.is_nullable::TEXT,
                c.column_default::TEXT
            FROM information_schema.columns c
            WHERE c.table_name = $1
            AND c.table_schema = 'public'
            ORDER BY c.ordinal_position;
        END;
        $$;
    `;

    const createConstraintsFunctionSQL = `
        CREATE OR REPLACE FUNCTION get_table_constraints(table_name TEXT)
        RETURNS TABLE (
            constraint_name TEXT,
            constraint_type TEXT,
            column_name TEXT
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                tc.constraint_name::TEXT,
                tc.constraint_type::TEXT,
                kcu.column_name::TEXT
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = $1
            AND tc.table_schema = 'public'
            ORDER BY tc.constraint_name;
        END;
        $$;
    `;

    try {
        await supabase.rpc('exec_sql', { sql: createColumnsFunctionSQL });
        await supabase.rpc('exec_sql', { sql: createConstraintsFunctionSQL });
        console.log('✅ Helper functions created');
    } catch (error) {
        console.log('⚠️  Could not create helper functions, continuing without them...');
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    diagnoseDatabaseIssues();
}

export default diagnoseDatabaseIssues;