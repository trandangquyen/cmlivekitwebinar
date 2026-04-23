import {closePool} from './db.js';
import {runMigrations} from './migrations.js';

try {
  await runMigrations();
} finally {
  await closePool();
}
