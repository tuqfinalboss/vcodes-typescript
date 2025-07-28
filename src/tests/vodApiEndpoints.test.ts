

import request from 'supertest';
import app from '../api/app';
import { getDb, closeDb } from '../infra/db';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../migrations/runMigrations';

const TEST_DB_FILE = 'vod-api.test.db';


beforeAll(async () => {
  // Always delete test DB before running
  try {
    fs.unlinkSync(path.resolve(process.cwd(), TEST_DB_FILE));
  } catch {}
  process.env.VOD_DB_FILE = TEST_DB_FILE;
  await runMigrations();
  jest.setTimeout(15000);
});

afterAll(async () => {
  await closeDb();
  try {
    fs.unlinkSync(path.resolve(process.cwd(), TEST_DB_FILE));
  } catch {}
});

describe('VOD API Endpoints', () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.run('DELETE FROM vod_categories');
    await db.run('DELETE FROM vod_items');
    await db.run('INSERT INTO vod_categories (id, xtream_category_id, name) VALUES (?, ?, ?)', 1, '10', 'TestCat');
    await db.run('INSERT INTO vod_categories (id, xtream_category_id, name) VALUES (?, ?, ?)', 2, '20', 'OtherCat');
    await db.run(`INSERT INTO vod_items (id, xtream_vod_id, title_original, title_normalized, category_id, stream_icon, added_at_xtream, container_extension)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      1, 1001, 'Test Movie', 'test movie', 1, 'icon.png', 1672531200, 'mp4');
    await db.run(`INSERT INTO vod_items (id, xtream_vod_id, title_original, title_normalized, category_id, stream_icon, added_at_xtream, container_extension)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      2, 1002, 'Other Movie', 'other movie', 2, 'icon2.png', 1704067200, 'mkv');
  });

  it('GET /v1/categories should return inserted categories', async () => {
    const res = await request(app).get('/v1/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body.map((c: any) => c.name)).toEqual(expect.arrayContaining(['TestCat', 'OtherCat']));
  });

  it('GET /v1/movies should return inserted movies', async () => {
    const res = await request(app).get('/v1/movies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body.map((m: any) => m.title_original)).toEqual(expect.arrayContaining(['Test Movie', 'Other Movie']));
  });

  it('GET /v1/movies?category_id=1 should filter movies by category', async () => {
    const res = await request(app).get('/v1/movies?category_id=1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title_original).toBe('Test Movie');
  });

  it('GET /v1/movies?q=Test should filter movies by title', async () => {
    const res = await request(app).get('/v1/movies?q=Test');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title_original).toBe('Test Movie');
  });

  it('GET /v1/movies?page=1&page_size=1 should paginate movies', async () => {
    const res = await request(app).get('/v1/movies?page=1&page_size=1');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(['Test Movie', 'Other Movie']).toContain(res.body[0].title_original);
  });

  it('GET /v1/movies?year=1970 should return no movies (since test data year is not 1970)', async () => {
    const res = await request(app).get('/v1/movies?year=1970');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('GET /v1/movies?min_rating=8 should return no movies (no ratings in test data)', async () => {
    const res = await request(app).get('/v1/movies?min_rating=8');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('GET /v1/movies/:id should return a single movie', async () => {
    const res = await request(app).get('/v1/movies/1');
    expect(res.status).toBe(200);
    expect(res.body.title_original).toBe('Test Movie');
  });

  it('GET /v1/movies/:id should return 404 for missing movie', async () => {
    const res = await request(app).get('/v1/movies/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Movie not found');
  });
});
