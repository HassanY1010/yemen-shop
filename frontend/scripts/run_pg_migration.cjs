const pg = require('pg');
const { Pool } = pg;

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres.abybrwyyhuacyrexoibi:Hhaall112233HH@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function runPgMigration() {
  console.log('Applying Production DDL Migrations to PostgreSQL...');
  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query(`
      -- Users
      ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Stores
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
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Categories
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Products
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
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Coupons
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS uses_count INT DEFAULT 0;
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0;
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Flash Sales
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS product_id INT;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'percentage';
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS max_quantity INT;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS sold_quantity INT DEFAULT 0;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS start_at TIMESTAMP;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS end_at TIMESTAMP;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Customers
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'YE';
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS password VARCHAR(255);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS force_password_change INT DEFAULT 0;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      -- Orders
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city VARCHAR(100);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
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
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    console.log('✅ PostgreSQL Schema DDL Migration Applied Successfully!');
    await pool.end();
  } catch (err) {
    console.error('❌ Migration Error:', err);
    await pool.end();
    process.exit(1);
  }
}

runPgMigration();
