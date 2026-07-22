import pg from 'pg';
const { Pool } = pg;

let pgPool: any = null;

export function getPgPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!pgPool) {
    pgPool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

export class PgD1Database {
  pool: any;
  constructor(pool: any) {
    this.pool = pool;
  }

  prepare(sql: string) {
    const pool = this.pool;

    let pgSql = sql
      .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/DATE\('now', '\+7 days'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '7 days'")
      .replace(/DATE\('now'\)/gi, 'CURRENT_DATE');

    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

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
            return { 
              meta: { 
                last_row_id: res.rows[0]?.id || 0, 
                changes: res.rowCount || 0 
              }, 
              results: res.rows 
            };
          } catch (err) {
            console.error('Pg Query Error (run):', err, 'SQL:', pgSql, 'Params:', params);
            throw err;
          }
        }
      };
    };
    return createStatement();
  }
}
