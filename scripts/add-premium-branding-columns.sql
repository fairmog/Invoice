-- Migration: Add Premium Branding Columns to Business Settings
-- Run this script to add premium branding features to existing databases

BEGIN;

-- Add premium branding columns to business_settings table
DO $$
BEGIN
    -- Check if premium_active column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='premium_active') THEN
        ALTER TABLE business_settings ADD COLUMN premium_active BOOLEAN DEFAULT false;
        RAISE NOTICE '✅ Added premium_active column';
    ELSE
        RAISE NOTICE 'ℹ️ premium_active column already exists';
    END IF;

    -- Add custom header text column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_header_text') THEN
        ALTER TABLE business_settings ADD COLUMN custom_header_text TEXT;
        RAISE NOTICE '✅ Added custom_header_text column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_header_text column already exists';
    END IF;

    -- Add custom header logo columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_header_logo_url') THEN
        ALTER TABLE business_settings ADD COLUMN custom_header_logo_url TEXT;
        RAISE NOTICE '✅ Added custom_header_logo_url column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_header_logo_url column already exists';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_header_logo_public_id') THEN
        ALTER TABLE business_settings ADD COLUMN custom_header_logo_public_id TEXT;
        RAISE NOTICE '✅ Added custom_header_logo_public_id column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_header_logo_public_id column already exists';
    END IF;

    -- Add custom footer logo columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_footer_logo_url') THEN
        ALTER TABLE business_settings ADD COLUMN custom_footer_logo_url TEXT;
        RAISE NOTICE '✅ Added custom_footer_logo_url column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_footer_logo_url column already exists';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_footer_logo_public_id') THEN
        ALTER TABLE business_settings ADD COLUMN custom_footer_logo_public_id TEXT;
        RAISE NOTICE '✅ Added custom_footer_logo_public_id column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_footer_logo_public_id column already exists';
    END IF;

    -- Add custom background color columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_header_bg_color') THEN
        ALTER TABLE business_settings ADD COLUMN custom_header_bg_color TEXT DEFAULT '#311d6b';
        RAISE NOTICE '✅ Added custom_header_bg_color column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_header_bg_color column already exists';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_footer_bg_color') THEN
        ALTER TABLE business_settings ADD COLUMN custom_footer_bg_color TEXT DEFAULT '#311d6b';
        RAISE NOTICE '✅ Added custom_footer_bg_color column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_footer_bg_color column already exists';
    END IF;

    -- Add hide aspree branding column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='hide_aspree_branding') THEN
        ALTER TABLE business_settings ADD COLUMN hide_aspree_branding BOOLEAN DEFAULT false;
        RAISE NOTICE '✅ Added hide_aspree_branding column';
    ELSE
        RAISE NOTICE 'ℹ️ hide_aspree_branding column already exists';
    END IF;

    -- Add text color columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_header_text_color') THEN
        ALTER TABLE business_settings ADD COLUMN custom_header_text_color TEXT DEFAULT '#ffffff';
        RAISE NOTICE '✅ Added custom_header_text_color column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_header_text_color column already exists';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_settings' AND column_name='custom_footer_text_color') THEN
        ALTER TABLE business_settings ADD COLUMN custom_footer_text_color TEXT DEFAULT '#ffffff';
        RAISE NOTICE '✅ Added custom_footer_text_color column';
    ELSE
        RAISE NOTICE 'ℹ️ custom_footer_text_color column already exists';
    END IF;

    RAISE NOTICE '🎉 Premium branding columns migration completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Premium branding features added:';
    RAISE NOTICE '   • Custom header text';
    RAISE NOTICE '   • Custom header & footer logos';  
    RAISE NOTICE '   • Custom header & footer background colors';
    RAISE NOTICE '   • Custom header & footer text colors';
    RAISE NOTICE '   • Option to hide Aspree branding';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Premium branding is now ready for implementation!';

END $$;

COMMIT;
