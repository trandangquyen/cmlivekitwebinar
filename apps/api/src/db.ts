import pg from 'pg';
import type {Pool as PoolType, QueryResult, QueryResultRow} from 'pg';
import {config} from './config.js';

const {Pool} = pg;

export const isPostgresEnabled = config.database.provider === 'postgres';

let pool: PoolType | null = null;

export const getPool = () => {
  if (!isPostgresEnabled) {
    throw new Error('PostgreSQL is not enabled for this API process.');
  }
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required when DATA_STORE=postgres.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      ssl: config.database.ssl ? {rejectUnauthorized: false} : undefined,
    });
  }
  return pool;
};

export const query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> => getPool().query<T>(text, values);

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
