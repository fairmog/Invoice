-- Safe Merchant Isolation Migration Script
-- This script safely adds merchant_id columns only where they don't exist
-- Run the safe-migration-check.sql first to understand current state

-- Function to safely add merchant_id column if it doesn't exist
CREATE OR REPLACE FUNCTION add_merchant_id_if_not_exists(target_table text) 
RETURNS void AS $$
BEGIN
    -- Check if merchant_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = target_table 
        AND column_name = 'merchant_id'
    ) THEN
        -- Add merchant_id column
        EXECUTE format('ALTER TABLE %I ADD COLUMN merchant_id INTEGER REFERENCES merchants(id)', target_table);
        RAISE NOTICE 'Added merchant_id column to table: %', target_table;
    ELSE
        RAISE NOTICE 'Table % already has merchant_id column - skipping', target_table;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add merchant_id to tables that need it (only if not exists)
SELECT add_merchant_id_if_not_exists('customers');
SELECT add_merchant_id_if_not_exists('products'); 
SELECT add_merchant_id_if_not_exists('invoices');
SELECT add_merchant_id_if_not_exists('orders');
SELECT add_merchant_id_if_not_exists('payment_methods');
SELECT add_merchant_id_if_not_exists('access_logs');

-- Note: business_settings already has merchant_id based on error message

-- Create indexes for new merchant_id columns (safe - will only create if column exists)
DO $$
BEGIN
    -- Customers
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'merchant_id') THEN
        CREATE INDEX IF NOT EXISTS idx_customers_merchant_id ON customers(merchant_id);
        RAISE NOTICE 'Created index on customers.merchant_id';
    END IF;
    
    -- Products  
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'merchant_id') THEN
        CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
        RAISE NOTICE 'Created index on products.merchant_id';
    END IF;
    
    -- Invoices
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'merchant_id') THEN
        CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices(merchant_id);
        RAISE NOTICE 'Created index on invoices.merchant_id';
    END IF;
    
    -- Orders
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'merchant_id') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id);
        RAISE NOTICE 'Created index on orders.merchant_id';
    END IF;
    
    -- Payment Methods
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'merchant_id') THEN
        CREATE INDEX IF NOT EXISTS idx_payment_methods_merchant_id ON payment_methods(merchant_id);
        RAISE NOTICE 'Created index on payment_methods.merchant_id';
    END IF;
    
    -- Access Logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'access_logs' AND column_name = 'merchant_id') THEN
        CREATE INDEX IF NOT EXISTS idx_access_logs_merchant_id ON access_logs(merchant_id);
        RAISE NOTICE 'Created index on access_logs.merchant_id';
    END IF;
END $$;

-- Clean up the helper function
DROP FUNCTION add_merchant_id_if_not_exists(text);