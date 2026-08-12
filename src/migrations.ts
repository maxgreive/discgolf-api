import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

export async function runDatabaseMigrations(pool: Pool) {
  const root = path.join(import.meta.dirname, '../migrations');
  await pool.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  for (const directory of ['training']) {
    const directoryPath = path.join(root, directory);
    const files = (await readdir(directoryPath)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const name = `${directory}/${file}`;
      const applied = await pool.query('select 1 from schema_migrations where name = $1', [name]);
      if (applied.rowCount) continue;
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(await readFile(path.join(directoryPath, file), 'utf8'));
        await client.query('insert into schema_migrations (name) values ($1)', [name]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }
  }
}
