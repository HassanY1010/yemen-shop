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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
        slug VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        max_products INT DEFAULT 50,
        max_orders INT DEFAULT 100,
        max_staff INT DEFAULT 2,
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
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        image VARCHAR(255),
        sort_order INT DEFAULT 0,
        is_active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        category_id INT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) DEFAULT 0,
        sale_price DECIMAL(10,2),
        cost_price DECIMAL(10,2),
        sku VARCHAR(100),
        barcode VARCHAR(100),
        stock INT DEFAULT 0,
        total_sold INT DEFAULT 0,
        image VARCHAR(255),
        gallery TEXT,
        status VARCHAR(50) DEFAULT 'active',
        is_active INT DEFAULT 1,
        is_featured INT DEFAULT 0,
        featured INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS featured INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS total_sold INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'YER';

      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL,
        store_id INT,
        url VARCHAR(255) NOT NULL,
        is_primary INT DEFAULT 0,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS store_id INT;
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_primary INT DEFAULT 0;

      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        code VARCHAR(50) NOT NULL,
        type VARCHAR(20) DEFAULT 'fixed',
        value DECIMAL(10,2) DEFAULT 0,
        min_order DECIMAL(10,2) DEFAULT 0,
        max_uses INT DEFAULT 0,
        uses_count INT DEFAULT 0,
        expires_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        is_active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;

      CREATE TABLE IF NOT EXISTS flash_sales (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        product_id INT,
        title VARCHAR(255),
        discount_percentage DECIMAL(5,2) DEFAULT 0,
        max_quantity INT,
        sold_quantity INT DEFAULT 0,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        is_active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS product_id INT;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS max_quantity INT;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS sold_quantity INT DEFAULT 0;
      ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;

      CREATE TABLE IF NOT EXISTS flash_sale_products (
        id SERIAL PRIMARY KEY,
        flash_sale_id INT NOT NULL,
        product_id INT NOT NULL,
        discount_price DECIMAL(10,2)
      );

      CREATE TABLE IF NOT EXISTS store_staff (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        permissions TEXT,
        is_active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        city VARCHAR(100),
        address TEXT,
        total_orders INT DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL,
        order_number VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_city VARCHAR(100),
        customer_address TEXT,
        subtotal DECIMAL(10,2) DEFAULT 0,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'cod',
        payment_status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT,
        product_name VARCHAR(255),
        price DECIMAL(10,2) DEFAULT 0,
        quantity INT DEFAULT 1,
        total DECIMAL(10,2) DEFAULT 0
      );

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id VARCHAR(255);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS store_id INT;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token VARCHAR(255);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

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
  const tables = ['users', 'stores', 'products', 'orders', 'categories', 'plans', 'coupons', 'order_items', 'flash_sales', 'store_staff'];
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
        if (typeof p === 'boolean') return p ? 1 : 0;
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
}
