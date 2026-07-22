-- =========================================================
-- SaaS Multi-Store Platform - Production Ready Migration
-- Safe & Idempotent (PostgreSQL Compatible)
-- =========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    store_id INT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'merchant',
    phone VARCHAR(50),
    avatar TEXT,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;

-- 2. Plans Table
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    billing_cycle VARCHAR(50) DEFAULT 'monthly',
    duration_days INT DEFAULT 30,
    max_stores INT DEFAULT 1,
    max_products INT DEFAULT 50,
    max_images INT DEFAULT 5,
    max_staff INT DEFAULT 2,
    max_orders INT DEFAULT 100,
    features TEXT,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 30;

-- 3. Stores Table
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT DEFAULT 1 REFERENCES plans(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    custom_domain VARCHAR(255),
    logo VARCHAR(255),
    banner VARCHAR(255),
    description TEXT,
    currency VARCHAR(10) DEFAULT 'YER',
    status VARCHAR(50) DEFAULT 'active',
    is_active INT DEFAULT 1,
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    total_sales NUMERIC(12,2) DEFAULT 0,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'YE',
    primary_color VARCHAR(50) DEFAULT '#4F46E5',
    secondary_color VARCHAR(50) DEFAULT '#818CF8',
    facebook VARCHAR(255),
    twitter VARCHAR(255),
    instagram VARCHAR(255),
    whatsapp VARCHAR(50),
    whatsapp_group VARCHAR(255),
    google_analytics_id VARCHAR(100),
    meta_pixel_id VARCHAR(100),
    shipping_rates TEXT,
    bank_accounts TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS primary_color VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS facebook VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_group VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_analytics_id VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS meta_pixel_id VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shipping_rates TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_accounts TEXT;

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- 5. Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    description TEXT,
    short_description TEXT,
    price NUMERIC(10,2) DEFAULT 0,
    sale_price NUMERIC(10,2),
    cost_price NUMERIC(10,2),
    stock INT DEFAULT 0,
    manage_stock INT DEFAULT 1,
    total_sold INT DEFAULT 0,
    image VARCHAR(255),
    gallery TEXT,
    currency VARCHAR(10) DEFAULT 'YER',
    weight NUMERIC(10,2),
    tags TEXT,
    meta_title VARCHAR(255),
    meta_description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    is_active INT DEFAULT 1,
    is_featured INT DEFAULT 0,
    featured INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS manage_stock INT DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_sold INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'YER';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured INT DEFAULT 0;

-- 6. Product Images Table
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt TEXT,
    is_primary INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS store_id INT;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt TEXT;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_primary INT DEFAULT 0;

-- 7. Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    value VARCHAR(255) NOT NULL,
    price_modifier NUMERIC(10,2) DEFAULT 0,
    stock INT DEFAULT 0,
    sku VARCHAR(100),
    sort_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Product Reviews Table
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id INT,
    customer_name VARCHAR(255) NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'percentage',
    value NUMERIC(10,2) DEFAULT 0,
    min_order NUMERIC(10,2) DEFAULT 0,
    min_order_amount NUMERIC(10,2) DEFAULT 0,
    max_uses INT,
    uses_count INT DEFAULT 0,
    used_count INT DEFAULT 0,
    expires_at TIMESTAMP,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order NUMERIC(10,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS uses_count INT DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;

-- 10. Flash Sales Table
CREATE TABLE IF NOT EXISTS flash_sales (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    discount_percentage NUMERIC(5,2) DEFAULT 0,
    discount_type VARCHAR(50) DEFAULT 'percentage',
    discount_value NUMERIC(10,2) DEFAULT 0,
    max_quantity INT,
    sold_quantity INT DEFAULT 0,
    starts_at TIMESTAMP,
    start_at TIMESTAMP,
    ends_at TIMESTAMP,
    end_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS product_id INT;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'percentage';
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS max_quantity INT;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS sold_quantity INT DEFAULT 0;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS start_at TIMESTAMP;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS end_at TIMESTAMP;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;

-- 11. Store Staff Table
CREATE TABLE IF NOT EXISTS store_staff (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'staff',
    permissions TEXT DEFAULT '[]',
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    password VARCHAR(255),
    force_password_change INT DEFAULT 0,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'YE',
    address TEXT,
    notes TEXT,
    total_orders INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS force_password_change INT DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'YE';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- 13. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    order_number VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_city VARCHAR(100),
    shipping_city VARCHAR(100),
    customer_address TEXT,
    shipping_address TEXT,
    shipping_country VARCHAR(100) DEFAULT 'YE',
    subtotal NUMERIC(10,2) DEFAULT 0,
    shipping NUMERIC(10,2) DEFAULT 0,
    shipping_cost NUMERIC(10,2) DEFAULT 0,
    discount NUMERIC(10,2) DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    tax NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'YER',
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'cod',
    payment_status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    admin_notes TEXT,
    receipt_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100) DEFAULT 'YE';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_image TEXT;

-- 14. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    price NUMERIC(10,2) DEFAULT 0,
    quantity INT DEFAULT 1,
    total NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS store_id INT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100);

-- 15. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id INT,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS store_id INT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 16. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    plan_id INT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active',
    starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    amount NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. System Notifications Table
CREATE TABLE IF NOT EXISTS system_notifications (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(50) DEFAULT 'merchant',
    store_id INT,
    user_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255) DEFAULT '',
    type VARCHAR(50) DEFAULT 'info',
    is_read INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'merchant';
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS link VARCHAR(255) DEFAULT '';

-- 18. Platform Settings Table
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for Maximum Query Performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_flash_sales_store ON flash_sales(store_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
