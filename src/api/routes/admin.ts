import { Router } from 'express';
import { VodSyncService } from '../../app/vodSyncService';
import { rateLimit } from '../middleware';
import logger from '../../infra/logger';

let isSyncing = false;
export function setIsSyncing(val: boolean) { isSyncing = val; }
export { isSyncing };
const router = Router();

router.post('/sync', rateLimit(), (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }
  isSyncing = true;
  res.status(200).json({ status: 'started' });
  const syncService = new VodSyncService();
  (async () => {
    try {
      await syncService.runFullSync();
    } catch (err) {
      logger.error({ err }, 'Sync failed');
    } finally {
      isSyncing = false;
    }
  })();
});

export default router;
