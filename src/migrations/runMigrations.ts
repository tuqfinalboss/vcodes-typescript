// Helper to run all migrations from tests or programmatically
import fs from 'fs';
import path from 'path';
import { getDb, closeDb } from '../infra/db';

export async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
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
      await migration.up(db);
      await db.run('INSERT INTO migrations (id, run_at) VALUES (?, ?)', id, new Date().toISOString());
    }
  }
  await closeDb();
}
