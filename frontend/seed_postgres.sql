-- PostgreSQL Migration & Seed SQL Script for Supabase

-- 1. Create Schema Tables
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    billing_cycle VARCHAR(50) DEFAULT 'monthly',
    duration_days INT DEFAULT 30,
    max_stores INT DEFAULT 1,
    max_products INT DEFAULT 5,
    max_images INT DEFAULT 5,
    max_staff INT DEFAULT 1,
    max_orders INT DEFAULT 50,
    features TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'merchant',
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT REFERENCES plans(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    primary_color VARCHAR(50) DEFAULT '#4F46E5',
    secondary_color VARCHAR(50) DEFAULT '#818CF8',
    currency VARCHAR(10) DEFAULT 'YER',
    status VARCHAR(50) DEFAULT 'active',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    total_sales NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    sku VARCHAR(100),
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    sale_price NUMERIC(10,2),
    stock INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    featured INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_primary INT DEFAULT 0,
    sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    password VARCHAR(255),
    force_password_change INT DEFAULT 0,
    city VARCHAR(100),
    total_orders INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'cod',
    subtotal NUMERIC(10,2) NOT NULL,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    shipping NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'YER',
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    shipping_address TEXT,
    shipping_city VARCHAR(100),
    notes TEXT,
    receipt_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL,
    total NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS system_notifications (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(50) NOT NULL,
    user_id INT,
    store_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255) DEFAULT '',
    type VARCHAR(50) DEFAULT 'system',
    is_read INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seed Initial Plans
INSERT INTO plans (id, name, slug, price, billing_cycle, duration_days, max_stores, max_products, max_images, max_staff, max_orders) VALUES 
(1, 'Free (تجربة مجانية 5 أيام)', 'free', 0, 'monthly', 5, 1, 5, 3, 1, 50),
(2, 'Basic', 'basic', 15000, 'monthly', 30, 1, 50, 5, 2, 500),
(3, 'Pro', 'pro', 30000, 'monthly', 30, 1, 200, 10, 5, 2000),
(4, 'Business', 'business', 60000, 'monthly', 30, -1, -1, -1, -1, -1)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  duration_days = EXCLUDED.duration_days,
  max_stores = EXCLUDED.max_stores,
  max_products = EXCLUDED.max_products,
  max_orders = EXCLUDED.max_orders,
  max_staff = EXCLUDED.max_staff;

-- 3. Seed Initial Users (Admin & Merchants)
INSERT INTO users (id, name, email, password, role, is_active) VALUES 
(1, 'Platform Admin', 'admin@platform.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'admin', 1),
(2, 'أحمد محمد', 'merchant@demo.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'merchant', 1)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Initial Store
INSERT INTO stores (id, user_id, plan_id, name, slug, description, primary_color, secondary_color, currency, status, subscription_status) VALUES
(1, 2, 3, 'متجر التقنية', 'tech-store', 'أفضل المنتجات التقنية بأسعار مناسبة', '#4F46E5', '#818CF8', 'YER', 'active', 'active')
ON CONFLICT (id) DO NOTHING;
