-- Migration script to add terms_conditions field to business_settings table
-- Run this in your Supabase SQL editor or database console

-- Add terms_conditions column to business_settings table
ALTER TABLE business_settings 
ADD COLUMN IF NOT EXISTS terms_conditions TEXT;

-- Add comment for documentation
COMMENT ON COLUMN business_settings.terms_conditions IS 'Terms and conditions text that appears on invoices';

-- Update any existing business_settings records to have empty terms_conditions if null
UPDATE business_settings 
SET terms_conditions = '' 
WHERE terms_conditions IS NULL;