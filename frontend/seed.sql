-- ============================================
-- Seed Data for SaaS Platform
-- ============================================

-- Insert Default Plans
INSERT OR IGNORE INTO plans (id, name, slug, price, billing_cycle, max_products, max_images, max_staff, max_orders, features) VALUES 
(1, 'مجاني', 'free', 0, 'monthly', 10, 3, 1, 50, '["basic_store","product_management","order_management"]'),
(2, 'أساسي', 'basic', 49, 'monthly', 50, 5, 2, 500, '["basic_store","product_management","order_management","customer_management","analytics_basic","custom_domain"]'),
(3, 'احترافي', 'pro', 99, 'monthly', 200, 10, 5, 2000, '["all_basic","advanced_analytics","discount_coupons","email_notifications","priority_support","seo_tools"]'),
(4, 'أعمال', 'business', 199, 'monthly', -1, -1, -1, -1, '["all_pro","unlimited_products","unlimited_orders","api_access","white_label","dedicated_support","multi_currency"]');

-- Insert Platform Admin
INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES 
(1, 'Platform Admin', 'admin@platform.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfUyPJzCRLvO4O2', 'admin', 1);

-- Insert Demo Merchant
INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES 
(2, 'أحمد محمد', 'merchant@demo.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfUyPJzCRLvO4O2', 'merchant', 1),
(3, 'سارة علي', 'sarah@demo.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfUyPJzCRLvO4O2', 'merchant', 1);

-- Insert Demo Stores
INSERT OR IGNORE INTO stores (id, user_id, plan_id, name, slug, description, primary_color, secondary_color, currency, status) VALUES
(1, 2, 3, 'متجر التقنية', 'tech-store', 'أفضل المنتجات التقنية بأسعار مناسبة', '#4F46E5', '#818CF8', 'SAR', 'active'),
(2, 3, 2, 'متجر الأزياء', 'fashion-store', 'آخر صيحات الموضة العصرية', '#EC4899', '#F9A8D4', 'SAR', 'active');

-- Insert Categories
INSERT OR IGNORE INTO categories (id, store_id, name, slug, sort_order, is_active) VALUES
(1, 1, 'الجوالات والهواتف', 'phones', 1, 1),
(2, 1, 'أجهزة الكمبيوتر', 'computers', 2, 1),
(3, 1, 'الإكسسوارات', 'accessories', 3, 1),
(8, 1, 'الساعات الذكية', 'smartwatches', 4, 1),
(9, 1, 'السماعات والصوتيات', 'audio', 5, 1),
(10, 1, 'الشواحن والبطاريات', 'chargers', 6, 1),
(11, 1, 'ألعاب الفيديو والكونسول', 'gaming', 7, 1),
(12, 1, 'الأجهزة المنزلية الذكية', 'smarthome', 8, 1),
(4, 2, 'ملابس رجالية', 'mens', 1, 1),
(5, 2, 'ملابس نسائية', 'womens', 2, 1),
(13, 2, 'أحذية وحقائب', 'shoes-bags', 3, 1),
(14, 2, 'ساعات وعطور', 'watches-perfumes', 4, 1),
(15, 2, 'إكسسوارات الموضة', 'fashion-accessories', 5, 1);

-- Insert Products for Store 1
INSERT OR IGNORE INTO products (id, store_id, category_id, name, slug, description, price, sale_price, stock, status, featured) VALUES
(1, 1, 1, 'آيفون 15 برو', 'iphone-15-pro', 'أحدث جوال من آبل مع كاميرا ثلاثية وشاشة Super Retina', 4999, 4599, 25, 'active', 1),
(2, 1, 1, 'سامسونج Galaxy S24', 'samsung-s24', 'جوال سامسونج الرائد مع تقنية الذكاء الاصطناعي', 3999, NULL, 30, 'active', 1),
(3, 1, 2, 'ماك بوك برو 14', 'macbook-pro-14', 'حاسوب آبل المحمول الاحترافي', 8999, 8499, 10, 'active', 1),
(4, 1, 3, 'سماعة AirPods Pro', 'airpods-pro', 'سماعات لاسلكية بتقنية إلغاء الضوضاء', 999, 849, 50, 'active', 0),
(5, 1, 3, 'شاحن MagSafe', 'magsafe-charger', 'شاحن مغناطيسي أصلي من آبل', 249, NULL, 100, 'active', 0),
(6, 2, 4, 'بدلة كلاسيكية فاخرة', 'classic-suit', 'بدلة رجالية من أعلى درجات الجودة', 1299, 999, 15, 'active', 1),
(7, 2, 5, 'فستان سواريه أنيق', 'elegant-gown', 'فستان فاخر مناسب للمناسبات الرسمية', 899, NULL, 20, 'active', 1);

-- Insert Product Images
INSERT OR IGNORE INTO product_images (id, product_id, store_id, url, is_primary, sort_order) VALUES
(1, 1, 1, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600', 1, 0),
(2, 2, 1, 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600', 1, 0),
(3, 3, 1, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600', 1, 0),
(4, 4, 1, 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600', 1, 0),
(5, 5, 1, 'https://images.unsplash.com/photo-1592753563062-83e0a9e77b31?w=600', 1, 0),
(6, 6, 2, 'https://images.unsplash.com/photo-1594938298603-c8148c4a0028?w=600', 1, 0),
(7, 7, 2, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600', 1, 0);

-- Insert Demo Customers
INSERT OR IGNORE INTO customers (id, store_id, name, email, phone, city, total_orders, total_spent) VALUES
(1, 1, 'محمد أحمد العمري', 'mohammed@customer.com', '0501234567', 'الرياض', 3, 14597),
(2, 1, 'فاطمة الزهراء', 'fatima@customer.com', '0559876543', 'جدة', 1, 4999),
(3, 1, 'عبدالله السالم', 'abdullah@customer.com', '0547654321', 'الدمام', 2, 9998),
(4, 2, 'نورة القحطاني', 'noura@customer.com', '0541234567', 'مكة', 1, 999);

-- Insert Demo Orders
INSERT OR IGNORE INTO orders (id, store_id, customer_id, order_number, status, payment_status, subtotal, total, customer_name, customer_phone, shipping_city) VALUES
(1, 1, 1, 'ORD-2024-001', 'completed', 'paid', 4599, 4599, 'محمد أحمد', '0501234567', 'الرياض'),
(2, 1, 2, 'ORD-2024-002', 'processing', 'paid', 4999, 4999, 'فاطمة الزهراء', '0559876543', 'جدة'),
(3, 1, 3, 'ORD-2024-003', 'pending', 'pending', 8499, 8499, 'عبدالله السالم', '0547654321', 'الدمام'),
(4, 1, 1, 'ORD-2024-004', 'completed', 'paid', 999, 999, 'محمد أحمد', '0501234567', 'الرياض'),
(5, 2, 4, 'ORD-2024-005', 'processing', 'paid', 999, 999, 'نورة القحطاني', '0541234567', 'مكة');

-- Insert Order Items
INSERT OR IGNORE INTO order_items (order_id, store_id, product_id, product_name, price, quantity, total) VALUES
(1, 1, 1, 'آيفون 15 برو', 4599, 1, 4599),
(2, 1, 2, 'سامسونج Galaxy S24', 3999, 1, 3999),
(2, 1, 4, 'سماعة AirPods Pro', 849, 1, 849),
(3, 1, 3, 'ماك بوك برو 14', 8499, 1, 8499),
(4, 1, 4, 'سماعة AirPods Pro', 999, 1, 999),
(5, 2, 7, 'فستان سواريه أنيق', 899, 1, 899);

-- Update store total_sales
UPDATE stores SET total_sales = 19096 WHERE id = 1;
UPDATE stores SET total_sales = 899 WHERE id = 2;
