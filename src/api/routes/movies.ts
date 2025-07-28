import { Router } from 'express';
import { getDb } from '../../infra/db';
import crypto from 'crypto';
import { rateLimit } from '../middleware';
import logger from '../../infra/logger';

const router = Router();

router.get('/', rateLimit(), async (req, res) => {
  try {
    const db = await getDb();
    const { q, category_id, year, min_rating, page = '1', page_size = '20' } = req.query;
    const filters = [];
    const params = [];
    if (category_id) {
      filters.push('category_id = ?');
      params.push(category_id);
    }
    if (q) {
      filters.push('title_original LIKE ?');
      params.push(`%${q}%`);
    }
    if (year) {
      filters.push("strftime('%Y', CAST(added_at_xtream AS INTEGER), 'unixepoch') = ?");
      params.push(year);
    }
    let join = '';
    if (min_rating) {
      join = 'LEFT JOIN tmdb_movies ON vod_items.id = tmdb_movies.vod_item_id';
      filters.push('tmdb_movies.vote_average >= ?');
      params.push(min_rating);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limit = Math.max(1, Math.min(100, parseInt(page_size as string, 10) || 20));
    const offset = (Math.max(1, parseInt(page as string, 10) || 1) - 1) * limit;
    const sql = `SELECT vod_items.* FROM vod_items ${join} ${where} LIMIT ? OFFSET ?`;
    const allParams = [...params, limit, offset];
    const rows = await db.all(sql, ...allParams);
    for (const row of rows) {
      if (row.is_ambiguous) {
        const candidate = await db.get('SELECT candidate_json FROM tmdb_candidates WHERE vod_item_id = ?', row.id);
        row.tmdb_candidates = candidate ? JSON.parse(candidate.candidate_json) : [];
      }
    }
    const etag = crypto.createHash('md5').update(JSON.stringify(rows)).digest('hex');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.json(rows);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch movies');
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

router.get('/:id', rateLimit(), async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT * FROM vod_items WHERE id = ?', req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    if (row.is_ambiguous) {
      const candidate = await db.get('SELECT candidate_json FROM tmdb_candidates WHERE vod_item_id = ?', row.id);
      row.tmdb_candidates = candidate ? JSON.parse(candidate.candidate_json) : [];
    }
    res.json(row);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch movie by id');
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

export default router;
