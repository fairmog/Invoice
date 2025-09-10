-- Database Schema Fix Script
-- Resolves the reported issues with business_settings and payment_methods tables
-- Run this script in your Supabase SQL editor

-- ==============================================
-- PHASE 1: Fix business_settings table
-- ==============================================

-- Add terms_conditions column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'business_settings' 
        AND column_name = 'terms_conditions'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE business_settings 
        ADD COLUMN terms_conditions TEXT;
        
        -- Add comment for documentation
        COMMENT ON COLUMN business_settings.terms_conditions IS 'Terms and conditions text that appears on invoices';
        
        -- Update any existing records to have empty terms_conditions
        UPDATE business_settings 
        SET terms_conditions = '' 
        WHERE terms_conditions IS NULL;
        
        RAISE NOTICE 'Added terms_conditions column to business_settings table';
    ELSE
        RAISE NOTICE 'terms_conditions column already exists in business_settings table';
    END IF;
END $$;

-- ==============================================
-- PHASE 2: Fix payment_methods table
-- ==============================================

-- First, check for and clean up any duplicate method_type entries
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT method_type, COUNT(*) 
        FROM payment_methods 
        GROUP BY method_type 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate method_type entries, cleaning up...', duplicate_count;
        
        -- Keep only the most recent record for each method_type
        DELETE FROM payment_methods 
        WHERE id NOT IN (
            SELECT DISTINCT ON (method_type) id
            FROM payment_methods 
            ORDER BY method_type, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        );
        
        RAISE NOTICE 'Cleaned up duplicate method_type entries';
    ELSE
        RAISE NOTICE 'No duplicate method_type entries found';
    END IF;
END $$;

-- Add unique constraint on method_type if it doesn't exist
DO $$ 
BEGIN 
    -- Check if unique constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'payment_methods' 
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name = 'method_type'
        AND tc.table_schema = 'public'
    ) THEN
        -- Add the unique constraint
        ALTER TABLE payment_methods 
        ADD CONSTRAINT payment_methods_method_type_unique UNIQUE (method_type);
        
        RAISE NOTICE 'Added UNIQUE constraint on payment_methods.method_type';
    ELSE
        RAISE NOTICE 'UNIQUE constraint on payment_methods.method_type already exists';
    END IF;
END $$;

-- ==============================================
-- PHASE 3: Ensure default payment methods exist
-- ==============================================

-- Insert default payment methods if they don't exist
INSERT INTO payment_methods (method_type, enabled, config_json) 
VALUES 
  ('bank_transfer', false, '{"bank_name": "", "account_number": "", "account_holder_name": "", "instructions": ""}'),
  ('xendit', false, '{"environment": "sandbox", "secret_key": "", "public_key": "", "webhook_token": "", "payment_methods": {"bank_transfer": true, "ewallet": true, "retail_outlet": true, "credit_card": true}}')
ON CONFLICT (method_type) DO NOTHING;

-- ==============================================
-- PHASE 4: Add helpful indexes if they don't exist
-- ==============================================

-- Create index on payment_methods.method_type if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_payment_methods_method_type ON payment_methods(method_type);

-- Create index on payment_methods.enabled for faster filtering
CREATE INDEX IF NOT EXISTS idx_payment_methods_enabled ON payment_methods(enabled);

-- ==============================================
-- VERIFICATION
-- ==============================================

-- Verify business_settings table structure
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'business_settings' 
    AND column_name = 'terms_conditions'
    AND table_schema = 'public';
    
    IF column_count > 0 THEN
        RAISE NOTICE '✅ VERIFIED: business_settings.terms_conditions column exists';
    ELSE
        RAISE WARNING '❌ ERROR: business_settings.terms_conditions column is missing';
    END IF;
END $$;

-- Verify payment_methods unique constraint
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'payment_methods' 
    AND tc.constraint_type = 'UNIQUE'
    AND kcu.column_name = 'method_type'
    AND tc.table_schema = 'public';
    
    IF constraint_count > 0 THEN
        RAISE NOTICE '✅ VERIFIED: payment_methods.method_type UNIQUE constraint exists';
    ELSE
        RAISE WARNING '❌ ERROR: payment_methods.method_type UNIQUE constraint is missing';
    END IF;
END $$;

-- Show final status
SELECT 
    'business_settings' as table_name,
    COUNT(*) as record_count,
    CASE WHEN COUNT(*) > 0 THEN '✅ Ready' ELSE '⚠️ No data' END as status
FROM business_settings
UNION ALL
SELECT 
    'payment_methods' as table_name,
    COUNT(*) as record_count,
    CASE WHEN COUNT(*) > 0 THEN '✅ Ready' ELSE '⚠️ No data' END as status
FROM payment_methods;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 DATABASE SCHEMA FIX COMPLETED!';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '✅ business_settings.terms_conditions column added/verified';
    RAISE NOTICE '✅ payment_methods.method_type UNIQUE constraint added/verified';
    RAISE NOTICE '✅ Duplicate payment method entries cleaned up';
    RAISE NOTICE '✅ Default payment methods ensured';
    RAISE NOTICE '✅ Performance indexes added';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Your application should now work without the reported errors!';
END $$;