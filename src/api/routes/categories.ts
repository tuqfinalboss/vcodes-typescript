import { Router } from 'express';
import { getDb } from '../../infra/db';
import crypto from 'crypto';
import { rateLimit } from '../middleware';
import logger from '../../infra/logger';

const router = Router();

router.get('/', rateLimit(), async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM vod_categories');
    const etag = crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.json(rows);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch categories');
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
