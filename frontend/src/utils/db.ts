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
      .replace(/datetime\('now',\s*'\+([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'")
      .replace(/datetime\('now',\s*'-([0-9]+)\s*hours?'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 hours'")
      .replace(/datetime\('now',\s*'\+([0-9]+)\s*months?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 months'")
      .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/DATE\('now',\s*'\+([0-9]+)\s*days?'\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'")
      .replace(/DATE\('now'\)/gi, 'CURRENT_DATE');

    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    // Auto append RETURNING id for INSERT queries if RETURNING is not already present
    const isInsert = /^\s*INSERT\s+INTO/i.test(pgSql);
    if (isInsert && !/RETURNING/i.test(pgSql)) {
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
