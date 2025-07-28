

import { VodSyncService } from '../app/vodSyncService';
import { getDb, closeDb } from '../infra/db';
import { runMigrations } from '../migrations/runMigrations';
import fs from 'fs';
import path from 'path';

const TEST_DB_FILE = 'vod-api.test.db';

beforeAll(async () => {
  process.env.VOD_DB_FILE = TEST_DB_FILE;
  try {
    fs.unlinkSync(path.resolve(process.cwd(), TEST_DB_FILE));
  } catch {}
  await runMigrations();
});

afterAll(async () => {
  await closeDb();
  try {
    fs.unlinkSync(path.resolve(process.cwd(), TEST_DB_FILE));
  } catch {}
});

describe('VodSyncService', () => {

  let service: VodSyncService;

  beforeEach(async () => {
    service = new VodSyncService();
    // Clean up DB tables that may cause UNIQUE constraint errors
    const db = await getDb();
    await db.run('DELETE FROM tmdb_movies');
    await db.run('DELETE FROM vod_items');
    await db.run('DELETE FROM vod_categories');
  });

  it('should instantiate', () => {
    expect(service).toBeInstanceOf(VodSyncService);
  });

  it('should persist categories in DB when syncCategories is called (mocked)', async () => {
    // Mock httpGet to return fake categories
    jest.spyOn(require('../../src/infra/httpClient'), 'httpGet').mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { category_id: '1', category_name: 'Action' },
        { category_id: '2', category_name: 'Comedy' },
      ]),
    });
    const count = await service.syncCategories();
    expect(count).toBe(2);
    const db = await getDb();
    const rows = await db.all('SELECT * FROM vod_categories WHERE xtream_category_id IN (?, ?)', '1', '2');
    expect(rows.length).toBe(2);
    expect(rows.map(r => r.name)).toEqual(expect.arrayContaining(['Action', 'Comedy']));
  });

  it('should persist movies in DB when syncMovies is called (mocked)', async () => {
    // Mock httpGet to return fake movies
    jest.spyOn(require('../../src/infra/httpClient'), 'httpGet').mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { stream_id: 101, name: 'Movie A', category_id: 1, stream_icon: 'iconA.png', added: 123456, container_extension: 'mp4' },
        { stream_id: 102, name: 'Movie B', category_id: 2, stream_icon: 'iconB.png', added: 654321, container_extension: 'mkv' },
      ]),
    });
    const count = await service.syncMovies();
    expect(count).toBe(2);
    const db = await getDb();
    const rows = await db.all('SELECT * FROM vod_items WHERE xtream_vod_id IN (?, ?)', 101, 102);
    expect(rows.length).toBe(2);
    expect(rows.map(r => r.title_original)).toEqual(expect.arrayContaining(['Movie A', 'Movie B']));
  });

  it('should enrich movies with TMDB data (mocked)', async () => {
    // Insert a movie into DB
    const db = await getDb();
    await db.run(
      `INSERT INTO vod_items (id, xtream_vod_id, title_original, title_normalized, category_id, stream_icon, added_at_xtream, container_extension)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      1, 201, 'Enrich Movie', 'enrich movie', 1, null, 123456, 'mp4'
    );
    // Mock TMDB search and details
    const httpGet = jest.spyOn(require('../../src/infra/httpClient'), 'httpGet');
    httpGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 999, title: 'Enrich Movie' }] }),
    });
    httpGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 999,
        overview: 'A test movie',
        poster_path: '/poster.jpg',
        genres: [{ id: 1, name: 'Action' }],
        original_title: 'Enrich Movie',
        original_language: 'en',
      }),
    });
    const enriched = await service.enrichWithTmdb();
    expect(enriched).toBe(1);
    const tmdb = await db.get('SELECT * FROM tmdb_movies WHERE vod_item_id = ?', 1);
    expect(tmdb).toBeDefined();
    expect(tmdb.tmdb_id).toBe(999);
    expect(tmdb.overview).toBe('A test movie');
    expect(JSON.parse(tmdb.genres)).toEqual([{ id: 1, name: 'Action' }]);
  });
});
