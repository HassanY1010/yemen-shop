import pg from 'pg';
const { Pool } = pg;

let pgPool: any = null;
const SUPABASE_FALLBACK_URL = 'postgresql://postgres.abybrwyyhuacyrexoibi:Hhaall112233HH@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function syncPgTables(pool: any) {
  try {
    await pool.query(`
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

      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
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
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS favicon VARCHAR(255);
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo VARCHAR(255);
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

      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        price NUMERIC(10,2) DEFAULT 0,
        billing_cycle VARCHAR(50) DEFAULT 'monthly',
        max_stores INT DEFAULT 1,
        max_products INT DEFAULT 50,
        max_images INT DEFAULT 5,
        max_staff INT DEFAULT 2,
        max_orders INT DEFAULT 100,
        duration_days INT DEFAULT 30,
        features TEXT,
        is_active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 30;

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        parent_id INT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
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

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        category_id INT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        short_description TEXT,
        price NUMERIC(10,2) DEFAULT 0,
        sale_price NUMERIC(10,2),
        cost_price NUMERIC(10,2),
        sku VARCHAR(100),
        barcode VARCHAR(100),
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
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image VARCHAR(255);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS views INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS manage_stock INT DEFAULT 1;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS total_sold INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'YER';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;
      ALTER TABLE products ALTER COLUMN image TYPE TEXT;

      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL,
        store_id INT,
        url TEXT NOT NULL,
        alt TEXT,
        is_primary INT DEFAULT 0,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS store_id INT;
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt TEXT;
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_primary INT DEFAULT 0;
      ALTER TABLE product_images ALTER COLUMN url TYPE TEXT;

      UPDATE product_images SET url = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600' WHERE url LIKE '%placeholder%' OR url IS NULL OR url = '' OR url LIKE '%no-image%' OR url LIKE 'data:%';
      UPDATE products SET image = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600' WHERE image LIKE '%placeholder%' OR image IS NULL OR image = '' OR image LIKE '%no-image%' OR image LIKE 'data:%';

      UPDATE products SET image = (SELECT url FROM product_images WHERE product_id = products.id ORDER BY is_primary DESC, id ASC LIMIT 1) WHERE EXISTS (SELECT 1 FROM product_images WHERE product_id = products.id);

      DELETE FROM flash_sales WHERE title LIKE '%test%' OR title LIKE '%Test%';
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS store_id INT;
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt TEXT;
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_primary INT DEFAULT 0;

      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL,
        store_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        value VARCHAR(255) NOT NULL,
        price_modifier NUMERIC(10,2) DEFAULT 0,
        stock INT DEFAULT 0,
        sku VARCHAR(100),
        sort_order INT DEFAULT 0,
        is_active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        product_id INT NOT NULL,
        customer_id INT,
        customer_name VARCHAR(255) NOT NULL,
        rating INT NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS flash_sales (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        product_id INT,
        title VARCHAR(255),
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

      CREATE TABLE IF NOT EXISTS flash_sale_products (
        id SERIAL PRIMARY KEY,
        flash_sale_id INT NOT NULL,
        product_id INT NOT NULL,
        discount_price NUMERIC(10,2)
      );

      CREATE TABLE IF NOT EXISTS store_staff (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        permissions TEXT DEFAULT '[]',
        is_active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        customer_id INT,
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

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL,
        store_id INT,
        product_id INT,
        product_name VARCHAR(255),
        product_sku VARCHAR(100),
        price NUMERIC(10,2) DEFAULT 0,
        quantity INT DEFAULT 1,
        total NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS store_id INT;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100);

      CREATE TABLE IF NOT EXISTS platform_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO platform_settings (key, value) VALUES ('support_whatsapp', '+967776461892') ON CONFLICT (key) DO NOTHING;

      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        store_id INT,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP,
        ip_address VARCHAR(100),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS store_id INT;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

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
    `);
  } catch (e) {
    console.error('Pg Table Sync Error:', e);
  }
}

async function syncPgSequences(pool: any) {
  const tables = ['users', 'stores', 'products', 'orders', 'categories', 'plans', 'coupons', 'order_items', 'flash_sales', 'store_staff', 'customers', 'product_variants', 'product_reviews', 'system_notifications', 'platform_settings'];
  for (const table of tables) {
    try {
      await pool.query(`
        SELECT setval(
          pg_get_serial_sequence('${table}', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1)
        );
      `);
    } catch (e) {}
  }
}

export function getPgPool() {
  const connectionString = process.env.DATABASE_URL || SUPABASE_FALLBACK_URL;

  if (!pgPool) {
    pgPool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
    syncPgTables(pgPool).then(() => syncPgSequences(pgPool));
  }
  return pgPool;
}

export class PgD1Database {
  pool: any;
  constructor(pool?: any) {
    this.pool = pool || getPgPool();
  }

  prepare(sql: string) {
    const pool = this.pool || getPgPool();

    let pgSql = sql
      .replace(/strftime\('([^']+)',\s*([a-zA-Z0-9_\.]+)\)/gi, (match, fmt, col) => {
        let pgFmt = fmt
          .replace('%Y', 'YYYY')
          .replace('%m', 'MM')
          .replace('%d', 'DD')
          .replace('%H', 'HH24')
          .replace('%M', 'MI')
          .replace('%S', 'SS');
        return `TO_CHAR(${col}, '${pgFmt}')`;
      })
      .replace(/datetime\('now',\s*'-([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 days'")
      .replace(/datetime\('now',\s*'\+([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'")
      .replace(/datetime\('now',\s*'-([0-9]+)\s*hours?'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 hours'")
      .replace(/datetime\('now',\s*'\+([0-9]+)\s*hours?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 hours'")
      .replace(/datetime\('now',\s*'-([0-9]+)\s*months?'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 months'")
      .replace(/datetime\('now',\s*'\+([0-9]+)\s*months?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 months'")
      .replace(/datetime\('now',\s*'start of month'\)/gi, "DATE_TRUNC('month', CURRENT_TIMESTAMP)")
      .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/datetime\(([^,]+),\s*'-([0-9]+)\s*days?'\)/gi, "$1 - INTERVAL '$2 days'")
      .replace(/datetime\(([^,]+),\s*'\+([0-9]+)\s*days?'\)/gi, "$1 + INTERVAL '$2 days'")
      .replace(/datetime\(([^)]+)\)/gi, "$1::timestamp")
      .replace(/DATE\('now',\s*'\+([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'")
      .replace(/DATE\('now',\s*'-([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 days'")
      .replace(/DATE\('now'\)/gi, 'CURRENT_DATE');

    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    // Extract table name from INSERT INTO table_name
    const insertMatch = pgSql.match(/^\s*INSERT\s+INTO\s+([a-zA-Z0-9_"]+)/i);
    const tableName = insertMatch ? insertMatch[1].replace(/"/g, '') : null;

    // Auto append RETURNING id for INSERT queries if RETURNING is not already present
    if (tableName && !/RETURNING/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }

    const createStatement = (params: any[] = []) => {
      const cleanParams = (params || []).map((p: any) => {
        if (p === undefined) return null;
        if (typeof p === 'boolean') return p ? 1 : 0;
        if (typeof p === 'number' && isNaN(p)) return 0;
        return p;
      });

      return {
        bind(...nextParams: any[]) {
          return createStatement([...params, ...nextParams]);
        },
        async first() {
          try {
            const res = await pool.query(pgSql, cleanParams);
            return res.rows[0] || null;
          } catch (err) {
            console.error('Pg Query Error (first):', err, 'SQL:', pgSql, 'Params:', cleanParams);
            throw err;
          }
        },
        async all() {
          try {
            const res = await pool.query(pgSql, cleanParams);
            return { results: res.rows };
          } catch (err) {
            console.error('Pg Query Error (all):', err, 'SQL:', pgSql, 'Params:', cleanParams);
            throw err;
          }
        },
        async run() {
          try {
            const res = await pool.query(pgSql, cleanParams);
            const lastRowId = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : 0;
            return { 
              meta: { 
                last_row_id: lastRowId, 
                changes: res.rowCount || 0 
              }, 
              results: res.rows || [] 
            };
          } catch (err: any) {
            // Handle duplicate key error on primary key by resetting sequence and retrying once
            if (err && err.code === '23505' && tableName) {
              try {
                await pool.query(`
                  SELECT setval(
                    pg_get_serial_sequence('${tableName}', 'id'),
                    COALESCE((SELECT MAX(id) FROM "${tableName}"), 1)
                  );
                `);
                const retryRes = await pool.query(pgSql, cleanParams);
                const lastRowId = retryRes.rows && retryRes.rows[0] && retryRes.rows[0].id ? retryRes.rows[0].id : 0;
                return {
                  meta: {
                    last_row_id: lastRowId,
                    changes: retryRes.rowCount || 0
                  },
                  results: retryRes.rows || []
                };
              } catch (retryErr) {
                console.error('Pg Query Error (retry failed):', retryErr, 'SQL:', pgSql, 'Params:', cleanParams);
                throw retryErr;
              }
            }
            console.error('Pg Query Error (run):', err, 'SQL:', pgSql, 'Params:', cleanParams);
            throw err;
          }
        }
      };
    };
    return createStatement();
  }

  async exec(sql: string) {
    const pool = this.pool || getPgPool();
    return await pool.query(sql);
  }

  async batch(statements: any[]) {
    const pool = this.pool || getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const stmt of statements) {
        const res = await stmt.run();
        results.push(res);
      }
      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

