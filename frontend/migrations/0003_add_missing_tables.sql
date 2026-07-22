-- Migration: Add missing tables for PWA, flash sales, variants, reviews, and tracking fields
-- Run this after applying 0002_add_features.sql

-- Add missing columns to stores table safely
ALTER TABLE stores ADD COLUMN google_analytics_id TEXT;
ALTER TABLE stores ADD COLUMN meta_pixel_id TEXT;
ALTER TABLE stores ADD COLUMN shipping_rates TEXT;

-- Create product reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create flash sales table
CREATE TABLE IF NOT EXISTS flash_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  discount_type TEXT DEFAULT 'percentage',
  discount_value REAL NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  max_quantity INTEGER,
  sold_quantity INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  price_modifier REAL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  sku TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_flash_sales_store ON flash_sales(store_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_product ON flash_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
