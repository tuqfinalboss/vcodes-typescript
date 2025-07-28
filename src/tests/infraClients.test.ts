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
});

afterAll(async () => {
  await closeDb();
  try {
    fs.unlinkSync(path.resolve(process.cwd(), TEST_DB_FILE));
  } catch {}
});
import { getRedis, closeRedis } from '../infra/redis';
import * as httpClient from '../infra/httpClient';
import logger from '../infra/logger';
import { config } from '../config';

describe('Infrastructure Clients', () => {
  beforeAll(() => {
    jest.spyOn(httpClient, 'httpGet').mockImplementation(async (url: string) => {
      return {
        status: 200,
        json: async () => ({ url }),
      } as any;
    });
    jest.spyOn(httpClient, 'httpPost').mockImplementation(async (url: string, body: any) => {
      return {
        status: 200,
        json: async () => ({ json: body }),
      } as any;
    });
  });
  afterAll(async () => {
    await closeDb();
    await closeRedis();
  });

  it('should connect to SQLite DB and run a simple query', async () => {
    jest.setTimeout(15000);
    const db = await getDb();
    const result = await db.get('SELECT 1 as value');
    expect(result.value).toBe(1);
  });

  it('should connect to Redis and set/get a value', async () => {
    jest.setTimeout(15000);
    const redis = getRedis();
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    expect(value).toBe('test-value');
    await redis.del('test-key');
  });


  it('should perform a GET request (mocked)', async () => {
    const res = await httpClient.httpGet('https://httpbin.org/get');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain('httpbin.org/get');
  });


  it('should perform a POST request (mocked)', async () => {
    const res = await httpClient.httpPost('https://httpbin.org/post', { foo: 'bar' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.json).toEqual({ foo: 'bar' });
  });

  it('should log messages using logger', () => {
    expect(() => logger.info('Logger test')).not.toThrow();
  });

  it('should load config values', () => {
    expect(config).toHaveProperty('dbPath');
    expect(config).toHaveProperty('redis');
    expect(config).toHaveProperty('xtream');
    expect(config).toHaveProperty('tmdb');
  });
});
