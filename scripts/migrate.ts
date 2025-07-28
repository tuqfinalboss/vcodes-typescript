// scripts/migrate.ts
// Run all JS migrations in /migrations (idempotent, up only)
import fs from 'fs';
import path from 'path';
import { getDb, closeDb } from '../src/infra/db';


async function runMigrations() {
  console.log('VOD_DB_FILE in migrate.ts:', process.env.VOD_DB_FILE);
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const db = await getDb();
  await db.run(`CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, run_at TEXT)`);
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();
  for (const file of files) {
    const id = file;
    const already = await db.get('SELECT 1 FROM migrations WHERE id = ?', id);
    if (already) continue;
    const migration = require(path.join(migrationsDir, file));
    if (migration.up) {
      console.log(`Running migration: ${file}`);
      await migration.up(db);
      await db.run('INSERT INTO migrations (id, run_at) VALUES (?, ?)', id, new Date().toISOString());
    }
  }
  await closeDb();
  console.log('All migrations complete.');
}

runMigrations().catch(e => { console.error(e); process.exit(1); });
