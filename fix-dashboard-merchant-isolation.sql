-- Fix Dashboard Statistics - Add Merchant Isolation to Invoices Table
-- This migration adds the missing merchant_id column and updates existing data

-- Step 1: Add merchant_id column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS merchant_id INTEGER;

-- Step 2: Update existing invoices with default merchant ID (assuming merchant ID 1 exists)
-- If no merchants exist, this will need to be adjusted
UPDATE invoices
SET merchant_id = 1
WHERE merchant_id IS NULL;

-- Step 3: Check if merchants table exists before adding foreign key
-- Add foreign key constraint only if merchants table exists
DO $$
BEGIN
    -- Check if merchants table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merchants') THEN
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_invoices_merchant'
            AND table_name = 'invoices'
        ) THEN
            ALTER TABLE invoices ADD CONSTRAINT fk_invoices_merchant
            FOREIGN KEY (merchant_id) REFERENCES merchants(id);
        END IF;
    ELSE
        RAISE NOTICE 'Merchants table does not exist. Skipping foreign key constraint.';
    END IF;
END $$;

-- Step 4: Add index for better performance on merchant_id queries
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices(merchant_id);

-- Step 5: Verification query to check the migration
DO $$
DECLARE
    invoice_count INTEGER;
    merchant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invoice_count FROM invoices WHERE merchant_id IS NOT NULL;
    SELECT COUNT(DISTINCT merchant_id) INTO merchant_count FROM invoices WHERE merchant_id IS NOT NULL;

    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Total invoices with merchant_id: %', invoice_count;
    RAISE NOTICE 'Unique merchants in invoices: %', merchant_count;
END $$;