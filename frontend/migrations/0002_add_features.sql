-- Migration: Add new fields for v2 features
-- Run this after applying 0001_initial_schema.sql

-- Add store_id and phone to users table
ALTER TABLE users ADD COLUMN store_id INTEGER;
ALTER TABLE users ADD COLUMN phone TEXT;

-- Update coupons table (recreate with new fields)
DROP TABLE IF EXISTS coupons;
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'percentage',
  value REAL NOT NULL,
  min_order_amount REAL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at DATETIME,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Add discount_amount to orders
ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;

-- Add index for coupons
CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
