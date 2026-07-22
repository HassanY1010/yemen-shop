import pg from 'pg';
const { Pool } = pg;

let pgPool: any = null;
const SUPABASE_FALLBACK_URL = 'postgresql://postgres.abybrwyyhuacyrexoibi:Hhaall112233HH@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function syncPgTables(pool: any) {
  try {
    await pool.query(`
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
    `);
  } catch (e) {
    console.error('Pg Table Sync Error:', e);
  }
}

async function syncPgSequences(pool: any) {
  const tables = ['users', 'stores', 'products', 'orders', 'categories', 'plans', 'coupons', 'order_items'];
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
      .replace(/datetime\('now',\s*'\+([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'")
      .replace(/datetime\('now',\s*'-([0-9]+)\s*hours?'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 hours'")
      .replace(/datetime\('now',\s*'\+([0-9]+)\s*months?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 months'")
      .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/DATE\('now',\s*'\+([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'")
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
      return {
        bind(...nextParams: any[]) {
          return createStatement([...params, ...nextParams]);
        },
        async first() {
          try {
            const res = await pool.query(pgSql, params);
            return res.rows[0] || null;
          } catch (err) {
            console.error('Pg Query Error (first):', err, 'SQL:', pgSql, 'Params:', params);
            throw err;
          }
        },
        async all() {
          try {
            const res = await pool.query(pgSql, params);
            return { results: res.rows };
          } catch (err) {
            console.error('Pg Query Error (all):', err, 'SQL:', pgSql, 'Params:', params);
            throw err;
          }
        },
        async run() {
          try {
            const res = await pool.query(pgSql, params);
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
                const retryRes = await pool.query(pgSql, params);
                const lastRowId = retryRes.rows && retryRes.rows[0] && retryRes.rows[0].id ? retryRes.rows[0].id : 0;
                return {
                  meta: {
                    last_row_id: lastRowId,
                    changes: retryRes.rowCount || 0
                  },
                  results: retryRes.rows || []
                };
              } catch (retryErr) {
                console.error('Pg Query Error (retry failed):', retryErr, 'SQL:', pgSql, 'Params:', params);
                throw retryErr;
              }
            }
            console.error('Pg Query Error (run):', err, 'SQL:', pgSql, 'Params:', params);
            throw err;
          }
        }
      };
    };
    return createStatement();
  }
}
