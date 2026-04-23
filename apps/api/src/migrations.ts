import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from './config.js';
import {getPool, isPostgresEnabled} from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const migrationDirCandidates = [
  path.resolve(process.cwd(), 'apps/api/migrations'),
  path.resolve(process.cwd(), 'migrations'),
  path.resolve(here, '../migrations'),
];

const findMigrationDir = async () => {
  for (const candidate of migrationDirCandidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    `No migration directory found. Tried: ${migrationDirCandidates.join(', ')}`,
  );
};

export const runMigrations = async () => {
  if (!isPostgresEnabled) {
    console.log('Skipping migrations because DATA_STORE is not postgres.');
    return;
  }

  const migrationDir = await findMigrationDir();
  const files = (await fs.readdir(migrationDir))
    .filter(file => file.endsWith('.sql'))
    .sort();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const existing = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version],
      );
      if (existing.rowCount) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version],
        );
        await client.query('COMMIT');
        console.log(`Applied migration ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
};

export const runAutoMigrations = async () => {
  if (config.database.autoMigrate) {
    await runMigrations();
  }
};
