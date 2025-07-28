import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;
let dbFile: string | null = null;

export async function getDb(filename?: string): Promise<Database> {
  const file = filename || process.env.VOD_DB_FILE || 'db/vod-api.db';
  const resolvedPath = path.resolve(process.cwd(), file);
  console.log('getDb: Opening DB at', resolvedPath);
  if (!dbInstance || dbFile !== file) {
    if (dbInstance) {
      await dbInstance.close();
    }
    dbInstance = await open({
      filename: resolvedPath,
      driver: sqlite3.Database,
    });
    dbFile = file;
  }
  return dbInstance;
}

export async function closeDb() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    dbFile = null;
  }
}
