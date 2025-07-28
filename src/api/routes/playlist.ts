import { Router } from 'express';
import { getDb } from '../../infra/db';
import { rateLimit } from '../middleware';
import logger from '../../infra/logger';
import { config } from '../../config';

const router = Router();

router.get('/', rateLimit(), async (req, res) => {
  try {
    const db = await getDb();
    const { genre, limit = '50' } = req.query;
    let sql = 'SELECT vod_items.*, tmdb_movies.genres FROM vod_items LEFT JOIN tmdb_movies ON vod_items.id = tmdb_movies.vod_item_id';
    const filters = [];
    const params = [];
    if (genre) {
      filters.push("tmdb_movies.genres LIKE ?");
      params.push(`%${genre}%`);
    }
    if (filters.length) {
      sql += ' WHERE ' + filters.join(' AND ');
    }
    sql += ' LIMIT ?';
    params.push(parseInt(limit as string, 10) || 50);
    const rows = await db.all(sql, ...params);
    let m3u = '#EXTM3U\n';
    for (const row of rows) {
      m3u += `#EXTINF:-1 tvg-id=\"${row.xtream_vod_id}\" tvg-name=\"${row.title_original}\" tvg-logo=\"${row.stream_icon || ''}\" group-title=\"${genre || ''}\",${row.title_original}\n`;
      const baseUrl = config.xtream.baseUrl.replace(/\/?$/, '');
      const username = encodeURIComponent(config.xtream.username);
      const password = encodeURIComponent(config.xtream.password);
      const vodId = row.xtream_vod_id;
      const ext = row.container_extension || 'mp4';
      m3u += `${baseUrl}/movie/${username}/${password}/${vodId}.${ext}\n`;
    }
    res.setHeader('Content-Type', 'application/x-mpegURL');
    res.send(m3u);
  } catch (err) {
    logger.error({ err }, 'Failed to export playlist');
    res.status(500).json({ error: 'Failed to export playlist' });
  }
});

export default router;
