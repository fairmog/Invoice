-- Fix Premium Persistence - Add Merchant Isolation to Business Settings
-- This script fixes the critical issue where premium upgrades don't persist across page refreshes

BEGIN;

-- Step 1: Add merchant_id column to business_settings table if it doesn't exist
DO $$
BEGIN
    -- Check if merchant_id column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='merchant_id') THEN
        ALTER TABLE business_settings ADD COLUMN merchant_id INTEGER REFERENCES merchants(id);
        RAISE NOTICE '✅ Added merchant_id column to business_settings';
    ELSE
        RAISE NOTICE '⚠️ merchant_id column already exists in business_settings';
    END IF;
END $$;

-- Step 2: Update existing business_settings records to link to the first merchant
-- This assumes the existing business settings belong to the first merchant created
DO $$
DECLARE
    first_merchant_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Get the ID of the first merchant
    SELECT id INTO first_merchant_id 
    FROM merchants 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF first_merchant_id IS NOT NULL THEN
        -- Update business_settings records that don't have a merchant_id
        UPDATE business_settings 
        SET merchant_id = first_merchant_id 
        WHERE merchant_id IS NULL;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '✅ Updated % business_settings records with merchant_id: %', updated_count, first_merchant_id;
    ELSE
        RAISE NOTICE '⚠️ No merchants found to assign to business_settings';
    END IF;
END $$;

-- Step 3: Make merchant_id NOT NULL after setting values
DO $$
BEGIN
    -- Check if we can make the column NOT NULL
    IF NOT EXISTS (SELECT 1 FROM business_settings WHERE merchant_id IS NULL) THEN
        ALTER TABLE business_settings ALTER COLUMN merchant_id SET NOT NULL;
        RAISE NOTICE '✅ Set merchant_id column to NOT NULL';
    ELSE
        RAISE NOTICE '⚠️ Cannot set merchant_id to NOT NULL - some records still have NULL values';
    END IF;
END $$;

-- Step 4: Add unique constraint to prevent duplicate settings per merchant
DO $$
BEGIN
    -- Check if unique constraint already exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name='business_settings' AND constraint_name='business_settings_merchant_id_unique') THEN
        -- Add unique constraint on merchant_id
        ALTER TABLE business_settings ADD CONSTRAINT business_settings_merchant_id_unique UNIQUE (merchant_id);
        RAISE NOTICE '✅ Added unique constraint on merchant_id in business_settings';
    ELSE
        RAISE NOTICE '⚠️ Unique constraint on merchant_id already exists';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not add unique constraint - may have duplicate merchant_id values';
END $$;

-- Step 5: Create index for performance
DO $$
BEGIN
    -- Check if index already exists
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='business_settings' AND indexname='idx_business_settings_merchant_id') THEN
        CREATE INDEX idx_business_settings_merchant_id ON business_settings(merchant_id);
        RAISE NOTICE '✅ Created index on merchant_id in business_settings';
    ELSE
        RAISE NOTICE '⚠️ Index on merchant_id already exists';
    END IF;
END $$;

-- Step 6: Display final status
DO $$
DECLARE
    total_merchants INTEGER;
    total_settings INTEGER;
    settings_with_merchant INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_merchants FROM merchants;
    SELECT COUNT(*) INTO total_settings FROM business_settings;
    SELECT COUNT(*) INTO settings_with_merchant FROM business_settings WHERE merchant_id IS NOT NULL;
    
    RAISE NOTICE '📊 Migration Summary:';
    RAISE NOTICE '   - Total merchants: %', total_merchants;
    RAISE NOTICE '   - Total business_settings: %', total_settings;
    RAISE NOTICE '   - Settings with merchant_id: %', settings_with_merchant;
    
    IF settings_with_merchant = total_settings AND total_settings > 0 THEN
        RAISE NOTICE '✅ Migration completed successfully - all settings have merchant isolation';
    ELSE
        RAISE NOTICE '⚠️ Migration incomplete - some settings may not have merchant isolation';
    END IF;
END $$;

COMMIT;

-- Verify the migration worked
SELECT 
    bs.id,
    bs.name as business_name,
    bs.premium_active,
    bs.merchant_id,
    m.business_name as merchant_business_name
FROM business_settings bs
LEFT JOIN merchants m ON bs.merchant_id = m.id
ORDER BY bs.id;