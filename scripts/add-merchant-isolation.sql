-- Migration: Add Merchant Isolation to Business Settings
-- This script fixes the critical issue where all users see the same business settings

BEGIN;

-- Step 1: Add merchant_id column to business_settings table
DO $$
BEGIN
    -- Check if merchant_id column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='merchant_id') THEN
        ALTER TABLE business_settings ADD COLUMN merchant_id INTEGER REFERENCES merchants(id);
        RAISE NOTICE '✅ Added merchant_id column to business_settings';
    ELSE
        RAISE NOTICE 'ℹ️ merchant_id column already exists in business_settings';
    END IF;
END $$;

-- Step 2: Update existing business_settings records to link to first merchant
-- This assumes the existing business settings belong to the first merchant created
DO $$
DECLARE
    first_merchant_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Get the ID of the first merchant (Bevelient)
    SELECT id INTO first_merchant_id 
    FROM merchants 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF first_merchant_id IS NOT NULL THEN
        -- Update all existing business_settings records to belong to first merchant
        UPDATE business_settings 
        SET merchant_id = first_merchant_id 
        WHERE merchant_id IS NULL;
        
        RAISE NOTICE '✅ Linked existing business settings to merchant ID: %', first_merchant_id;
        
        -- Show how many records were updated
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'ℹ️ Updated % business_settings records', updated_count;
    ELSE
        RAISE NOTICE '⚠️ No merchants found - no business settings updated';
    END IF;
END $$;

-- Step 3: Make merchant_id NOT NULL to enforce the relationship
DO $$
BEGIN
    ALTER TABLE business_settings ALTER COLUMN merchant_id SET NOT NULL;
    RAISE NOTICE '✅ Made merchant_id NOT NULL in business_settings';
END $$;

-- Step 4: Create unique constraint to ensure one business_settings per merchant
DO $$
BEGIN
    -- Check if unique constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='business_settings' 
        AND constraint_name='business_settings_merchant_id_key'
    ) THEN
        ALTER TABLE business_settings ADD CONSTRAINT business_settings_merchant_id_key UNIQUE (merchant_id);
        RAISE NOTICE '✅ Added unique constraint on merchant_id';
    ELSE
        RAISE NOTICE 'ℹ️ Unique constraint on merchant_id already exists';
    END IF;
END $$;

-- Step 5: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_business_settings_merchant_id ON business_settings(merchant_id);

-- Summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Merchant isolation migration completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Changes made:';
    RAISE NOTICE '   • Added merchant_id column to business_settings';
    RAISE NOTICE '   • Linked existing business settings to first merchant';
    RAISE NOTICE '   • Made merchant_id NOT NULL (required)';
    RAISE NOTICE '   • Added unique constraint (one business_settings per merchant)';
    RAISE NOTICE '   • Created performance index';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Each merchant now has isolated business settings!';
    RAISE NOTICE '⚠️ IMPORTANT: Update your application code to filter by merchant_id';
END $$;

COMMIT;