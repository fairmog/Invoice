/**
 * Test Script for Database Schema Fixes
 * Tests that the business_settings and payment_methods issues are resolved
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import SupabaseDatabase from '../src/supabase-database.js';

// Load environment variables
dotenv.config();

async function testDatabaseFixes() {
    console.log('🧪 Starting database fixes validation tests...\n');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing Supabase environment variables');
        process.exit(1);
    }

    const db = new SupabaseDatabase();
    let testsPassed = 0;
    let testsTotal = 0;

    try {
        // Test 1: Business Settings with terms_conditions
        console.log('📋 Test 1: Business Settings terms_conditions field...');
        testsTotal++;
        
        try {
            const testSettings = {
                name: 'Test Business',
                email: 'test@business.com',
                phone: '+1234567890',
                address: 'Test Address',
                termsAndConditions: 'Test terms and conditions text'
            };
            
            const result = await db.updateBusinessSettings(testSettings);
            
            if (result && result.terms_conditions === testSettings.termsAndConditions) {
                console.log('✅ Test 1 PASSED: Business settings with terms_conditions works');
                testsPassed++;
            } else {
                console.log('❌ Test 1 FAILED: terms_conditions not saved properly');
                console.log('Expected:', testSettings.termsAndConditions);
                console.log('Got:', result?.terms_conditions);
            }
        } catch (error) {
            console.log('❌ Test 1 FAILED: Business settings update error:', error.message);
            if (error.message.includes('terms_conditions')) {
                console.log('🔧 Hint: Run the migration script to add the missing column');
            }
        }

        // Test 2: Payment Methods Upsert
        console.log('\n💳 Test 2: Payment Methods upsert operation...');
        testsTotal++;
        
        try {
            const testPaymentMethods = {
                bank_transfer: {
                    enabled: true,
                    bank_name: 'Test Bank',
                    account_number: '1234567890',
                    account_holder_name: 'Test Account Holder',
                    bank_branch: 'Test Branch',
                    instructions: 'Test instructions'
                },
                xendit: {
                    enabled: false,
                    environment: 'sandbox',
                    secret_key: 'test_secret',
                    public_key: 'test_public',
                    webhook_token: 'test_webhook',
                    payment_methods: {
                        bank_transfer: true,
                        ewallet: true,
                        retail_outlet: false,
                        credit_card: true
                    }
                }
            };
            
            const result = await db.updatePaymentMethods(testPaymentMethods);
            
            if (result && 
                result.bank_transfer && 
                result.bank_transfer.enabled === true && 
                result.bank_transfer.bank_name === 'Test Bank' &&
                result.xendit &&
                result.xendit.enabled === false) {
                console.log('✅ Test 2 PASSED: Payment methods upsert works');
                testsPassed++;
            } else {
                console.log('❌ Test 2 FAILED: Payment methods not updated properly');
                console.log('Result:', JSON.stringify(result, null, 2));
            }
        } catch (error) {
            console.log('❌ Test 2 FAILED: Payment methods update error:', error.message);
            if (error.code === '42P10' || error.message.includes('no unique or exclusion constraint')) {
                console.log('🔧 Hint: Run the migration script to add the UNIQUE constraint');
            }
        }

        // Test 3: Payment Methods Duplicate Prevention
        console.log('\n🔄 Test 3: Payment Methods duplicate prevention...');
        testsTotal++;
        
        try {
            // Try to update the same payment methods again
            const duplicateUpdate = {
                bank_transfer: {
                    enabled: false,
                    bank_name: 'Updated Bank',
                    account_number: '0987654321',
                    account_holder_name: 'Updated Account Holder',
                    bank_branch: 'Updated Branch',
                    instructions: 'Updated instructions'
                }
            };
            
            const result = await db.updatePaymentMethods(duplicateUpdate);
            
            if (result && 
                result.bank_transfer && 
                result.bank_transfer.enabled === false && 
                result.bank_transfer.bank_name === 'Updated Bank') {
                console.log('✅ Test 3 PASSED: Payment methods update/overwrite works');
                testsPassed++;
            } else {
                console.log('❌ Test 3 FAILED: Payment methods update failed');
                console.log('Result:', JSON.stringify(result, null, 2));
            }
        } catch (error) {
            console.log('❌ Test 3 FAILED: Duplicate update error:', error.message);
        }

        // Test 4: Business Settings Retrieval
        console.log('\n📖 Test 4: Business Settings retrieval...');
        testsTotal++;
        
        try {
            const settings = await db.getBusinessSettings();
            
            if (settings && 
                settings.name === 'Test Business' && 
                settings.terms_conditions === 'Test terms and conditions text') {
                console.log('✅ Test 4 PASSED: Business settings retrieval works');
                testsPassed++;
            } else {
                console.log('❌ Test 4 FAILED: Business settings not retrieved properly');
                console.log('Settings:', JSON.stringify(settings, null, 2));
            }
        } catch (error) {
            console.log('❌ Test 4 FAILED: Business settings retrieval error:', error.message);
        }

        // Test 5: Payment Methods Retrieval
        console.log('\n💰 Test 5: Payment Methods retrieval...');
        testsTotal++;
        
        try {
            const methods = await db.getPaymentMethods();
            
            if (methods && 
                methods.bank_transfer && 
                methods.bank_transfer.bank_name === 'Updated Bank' &&
                methods.xendit) {
                console.log('✅ Test 5 PASSED: Payment methods retrieval works');
                testsPassed++;
            } else {
                console.log('❌ Test 5 FAILED: Payment methods not retrieved properly');
                console.log('Methods:', JSON.stringify(methods, null, 2));
            }
        } catch (error) {
            console.log('❌ Test 5 FAILED: Payment methods retrieval error:', error.message);
        }

        // Final Results
        console.log('\n🎯 TEST RESULTS:');
        console.log('================');
        console.log(`✅ Tests Passed: ${testsPassed}/${testsTotal}`);
        console.log(`❌ Tests Failed: ${testsTotal - testsPassed}/${testsTotal}`);
        
        if (testsPassed === testsTotal) {
            console.log('\n🎉 ALL TESTS PASSED! Your database schema fixes are working correctly.');
            console.log('✅ The reported errors should now be resolved.');
        } else {
            console.log('\n⚠️  Some tests failed. You may need to:');
            console.log('1. Run the SQL migration script: scripts/fix-database-schema-issues.sql');
            console.log('2. Check your Supabase connection and permissions');
            console.log('3. Verify the database schema matches the expected structure');
        }

    } catch (error) {
        console.error('💥 Test suite failed:', error.message);
        console.error(error.stack);
    } finally {
        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        try {
            await db.updateBusinessSettings({
                name: 'Toko Gadget Teknologi',
                email: 'billing@tokogadget.co.id',
                termsAndConditions: ''
            });
            console.log('✅ Test data cleaned up');
        } catch (error) {
            console.log('⚠️  Could not clean up test data:', error.message);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    testDatabaseFixes();
}

export default testDatabaseFixes;