-- AI Invoice Generator Database Schema for Supabase
-- Run this script in your Supabase SQL editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Business Settings Table
CREATE TABLE business_settings (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  tax_id TEXT,
  tax_enabled BOOLEAN DEFAULT false,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_name TEXT DEFAULT 'PPN',
  tax_description TEXT,
  hide_business_name BOOLEAN DEFAULT false,
  business_code TEXT,
  terms_conditions TEXT,
  logo_url TEXT,
  logo_public_id TEXT,
  logo_filename TEXT,
  -- Premium branding fields
  premium_active BOOLEAN DEFAULT false,
  custom_header_text TEXT,
  custom_header_logo_url TEXT,
  custom_header_logo_public_id TEXT,
  custom_footer_logo_url TEXT,
  custom_footer_logo_public_id TEXT,
  custom_header_bg_color TEXT DEFAULT '#311d6b',
  custom_footer_bg_color TEXT DEFAULT '#311d6b',
  custom_header_text_color TEXT DEFAULT '#ffffff',
  custom_footer_text_color TEXT DEFAULT '#ffffff',
  hide_aspree_branding BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers Table
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  source_invoice_id INTEGER,
  source_invoice_number TEXT,
  first_invoice_date TIMESTAMP WITH TIME ZONE,
  last_invoice_date TIMESTAMP WITH TIME ZONE,
  invoice_count INTEGER DEFAULT 0,
  total_spent DECIMAL(15,2) DEFAULT 0,
  extraction_method TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_price DECIMAL(15,2) NOT NULL,
  cost_price DECIMAL(15,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  dimensions TEXT,
  weight DECIMAL(10,2),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices Table
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  merchant_name TEXT,
  merchant_address TEXT,
  merchant_phone TEXT,
  merchant_email TEXT,
  invoice_date DATE,
  due_date DATE,
  original_due_date DATE,
  status TEXT DEFAULT 'draft',
  payment_stage TEXT DEFAULT 'full_payment',
  payment_status TEXT DEFAULT 'pending',
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  grand_total DECIMAL(15,2),
  currency TEXT DEFAULT 'IDR',
  payment_terms TEXT DEFAULT 'Net 30',
  notes TEXT,
  items_json JSONB,
  metadata_json JSONB,
  payment_schedule_json JSONB,
  notes_json JSONB,
  calculations_json JSONB,
  customer_token TEXT,
  payment_confirmation_file TEXT,
  payment_confirmation_notes TEXT,
  payment_confirmation_date TIMESTAMP WITH TIME ZONE,
  confirmation_status TEXT,
  merchant_confirmation_notes TEXT,
  confirmation_reviewed_date TIMESTAMP WITH TIME ZONE,
  dp_confirmed_date TIMESTAMP WITH TIME ZONE,
  final_payment_token TEXT,
  final_payment_amount DECIMAL(15,2),
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending',
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipping_address TEXT,
  billing_address TEXT,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2),
  notes TEXT,
  tracking_number TEXT,
  shipped_date TIMESTAMP WITH TIME ZONE,
  delivered_date TIMESTAMP WITH TIME ZONE,
  source_invoice_id INTEGER,
  source_invoice_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  product_name TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(15,2),
  line_total DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Methods Table
CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  method_type TEXT NOT NULL UNIQUE, -- 'bank_transfer', 'xendit', etc.
  enabled BOOLEAN DEFAULT false,
  config_json JSONB, -- Store method-specific configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Access Logs Table
CREATE TABLE access_logs (
  id SERIAL PRIMARY KEY,
  ip_address TEXT,
  user_agent TEXT,
  access_type TEXT,
  customer_email TEXT,
  invoice_id INTEGER,
  success BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchants Table (for authentication/user management)
CREATE TABLE merchants (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  business_name TEXT,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  status TEXT DEFAULT 'active',
  email_verified BOOLEAN DEFAULT false,
  email_verification_token TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  subscription_plan TEXT DEFAULT 'free',
  subscription_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer_email ON invoices(customer_email);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_payment_stage ON invoices(payment_stage);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX idx_invoices_final_payment_token ON invoices(final_payment_token);
CREATE INDEX idx_invoices_dp_confirmed_date ON invoices(dp_confirmed_date);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_payment_methods_method_type ON payment_methods(method_type);
CREATE INDEX idx_payment_methods_enabled ON payment_methods(enabled);
CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchants_reset_token ON merchants(reset_token);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_business_settings_updated_at BEFORE UPDATE ON business_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) - Optional for multi-tenant setup
-- ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Insert default payment methods
INSERT INTO payment_methods (method_type, enabled, config_json) VALUES
  ('bank_transfer', false, '{"bank_name": "", "account_number": "", "account_holder_name": "", "instructions": ""}'),
  ('xendit', false, '{"environment": "sandbox", "secret_key": "", "public_key": "", "webhook_token": "", "payment_methods": {"bank_transfer": true, "ewallet": true, "retail_outlet": true, "credit_card": true}}');

-- Insert default business settings
INSERT INTO business_settings (name, email, address, phone, website, tax_id, tax_rate, business_code) VALUES
  ('Toko Gadget Teknologi', 'billing@tokogadget.co.id', 'Jl. Teknologi No. 123, Jakarta Selatan, DKI Jakarta 12345', '+62 21 1234 5678', 'https://tokogadget.co.id', '01.123.456.7-123.000', 11, 'TGT');
