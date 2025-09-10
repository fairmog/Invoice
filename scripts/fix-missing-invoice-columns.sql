-- Fix Missing Invoice Table Columns
-- This script adds missing columns that are referenced in the application code
-- Run this script in your Supabase SQL editor

-- ==============================================
-- PHASE 1: Add missing invoice table columns
-- ==============================================

-- Add dp_confirmed_date column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'dp_confirmed_date'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN dp_confirmed_date TIMESTAMP WITH TIME ZONE;
        
        -- Add comment for documentation
        COMMENT ON COLUMN invoices.dp_confirmed_date IS 'Date when down payment was confirmed by customer';
        
        RAISE NOTICE 'Added dp_confirmed_date column to invoices table';
    ELSE
        RAISE NOTICE 'dp_confirmed_date column already exists in invoices table';
    END IF;
END $$;

-- Add final_payment_token column if it doesn't exist (for payment schedule tracking)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'final_payment_token'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN final_payment_token TEXT;
        
        -- Add comment for documentation
        COMMENT ON COLUMN invoices.final_payment_token IS 'Token for final payment link in payment schedule';
        
        RAISE NOTICE 'Added final_payment_token column to invoices table';
    ELSE
        RAISE NOTICE 'final_payment_token column already exists in invoices table';
    END IF;
END $$;

-- Add final_payment_amount column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'final_payment_amount'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN final_payment_amount DECIMAL(15,2);
        
        -- Add comment for documentation
        COMMENT ON COLUMN invoices.final_payment_amount IS 'Amount for final payment in payment schedule';
        
        RAISE NOTICE 'Added final_payment_amount column to invoices table';
    ELSE
        RAISE NOTICE 'final_payment_amount column already exists in invoices table';
    END IF;
END $$;

-- Ensure all required columns have proper indexing
CREATE INDEX IF NOT EXISTS idx_invoices_payment_stage ON invoices(payment_stage);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_final_payment_token ON invoices(final_payment_token);
CREATE INDEX IF NOT EXISTS idx_invoices_dp_confirmed_date ON invoices(dp_confirmed_date);

-- ==============================================
-- PHASE 2: Update missing fields for consistency
-- ==============================================

-- Update invoices with missing payment_stage
UPDATE invoices 
SET payment_stage = 'full_payment' 
WHERE payment_stage IS NULL;

-- Update invoices with missing payment_status
UPDATE invoices 
SET payment_status = 'pending' 
WHERE payment_status IS NULL;

-- ==============================================
-- VERIFICATION
-- ==============================================

-- Verify all required columns exist
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    col_name TEXT;
BEGIN
    -- Check for required columns
    FOREACH col_name IN ARRAY ARRAY['dp_confirmed_date', 'final_payment_token', 'final_payment_amount', 'payment_stage', 'payment_status']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoices' 
            AND column_name = col_name
            AND table_schema = 'public'
        ) THEN
            missing_columns := array_append(missing_columns, col_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE WARNING '❌ Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All required invoice columns exist';
    END IF;
END $$;

-- Show current invoice table structure (relevant columns only)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
AND column_name IN (
    'dp_confirmed_date', 
    'final_payment_token', 
    'final_payment_amount', 
    'payment_stage', 
    'payment_status',
    'payment_schedule_json',
    'original_due_date',
    'due_date'
)
ORDER BY column_name;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 INVOICE TABLE SCHEMA FIX COMPLETED!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ dp_confirmed_date column added/verified';
    RAISE NOTICE '✅ final_payment_token column added/verified';
    RAISE NOTICE '✅ final_payment_amount column added/verified';
    RAISE NOTICE '✅ Payment stage and status columns verified';
    RAISE NOTICE '✅ Performance indexes added';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Invoice loading and payment confirmation should now work properly!';
END $$;