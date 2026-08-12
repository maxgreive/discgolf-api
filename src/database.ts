import pg from 'pg';
import env from './env';

const { Pool } = pg;
let pool: pg.Pool | undefined;

export function databaseConfigured() {
  return Boolean(env.DATABASE_URL);
}

export function databasePool() {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  pool ??= new Pool({ connectionString: env.DATABASE_URL });
  return pool;
}
