import request from 'supertest';

import app from '../api/app';
import * as adminRoute from '../api/routes/admin';


describe('Admin Sync Endpoint', () => {
  beforeAll(() => {
    jest.setTimeout(15000);
  });

  it('POST /v1/admin/sync should trigger sync and return started', async () => {
    jest.spyOn(require('../../src/app/vodSyncService'), 'VodSyncService').mockImplementation(() => ({
      syncCategories: jest.fn().mockResolvedValue(1),
      syncMovies: jest.fn().mockResolvedValue(1),
      enrichWithTmdb: jest.fn().mockResolvedValue(1),
    }));
    const res = await request(app).post('/v1/admin/sync');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('started');
  });

  it('POST /v1/admin/sync should return 409 if already syncing', async () => {
    const prev = adminRoute.isSyncing;
    adminRoute.setIsSyncing(true);
    const res = await request(app).post('/v1/admin/sync');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Sync already in progress/);
    adminRoute.setIsSyncing(prev);
  });
});
