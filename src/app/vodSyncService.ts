import { getDb } from '../infra/db';
import logger from '../infra/logger';
import { config } from '../config';
import { httpGet } from '../infra/httpClient';

export class VodSyncService {
  async syncCategories() {
    const xtreamUrl = `${config.xtream.baseUrl}/player_api.php?username=${config.xtream.username}&password=${config.xtream.password}&action=get_vod_categories`;
    logger.info({ xtreamUrl }, 'Fetching VOD categories from Xtream');
    try {
      const res = await httpGet(xtreamUrl);
      if (!res.ok) throw new Error(`Xtream API error: ${res.status}`);
      const categories = await res.json();
      if (!Array.isArray(categories)) throw new Error('Invalid categories response');
      const db = await getDb();
      for (const cat of categories) {
        if (!cat.category_id || !cat.category_name) continue;
        await db.run(
          `INSERT INTO vod_categories (name, xtream_category_id) VALUES (?, ?)
           ON CONFLICT(xtream_category_id) DO UPDATE SET name=excluded.name`,
          cat.category_name,
          cat.category_id
        );
      }
      logger.info(`Upserted ${categories.length} categories.`);
      return categories.length;
    } catch (err) {
      logger.error({ err }, 'Failed to sync categories');
      throw err;
    }
  }

  async syncMovies() {
    const xtreamUrl = `${config.xtream.baseUrl}/player_api.php?username=${config.xtream.username}&password=${config.xtream.password}&action=get_vod_streams`;
    logger.info({ xtreamUrl }, 'Fetching VOD movies from Xtream');
    try {
      const db = await getDb();
      logger.info('syncMovies: got DB connection');
      const lastRun = await db.get('SELECT MAX(finished_at) as last_finished, MAX(inserted) as last_marker FROM sync_runs WHERE status = "success"');
      let last_marker = 0;
      if (lastRun && lastRun.last_marker) {
        last_marker = lastRun.last_marker;
      }
      logger.info({ last_marker }, 'syncMovies: got last_marker');
      const res = await httpGet(xtreamUrl);
      logger.info({ status: res.status }, 'syncMovies: got HTTP response');
      if (!res.ok) throw new Error(`Xtream API error: ${res.status}`);
      const movies = await res.json();
      logger.info({ count: Array.isArray(movies) ? movies.length : null, type: typeof movies }, 'syncMovies: parsed movies JSON');
      if (!Array.isArray(movies)) throw new Error('Invalid movies response');
      let upserted = 0;
      let maxAdded = last_marker;
      let processed = 0;
      for (const m of movies) {
        processed++;
        if (processed % 100 === 0) {
          logger.info({ processed, upserted }, 'syncMovies: processing movies');
        }
        if (!m.stream_id || !m.name || !m.category_id || !m.added) continue;
        const addedNum = Number(m.added);
        if (addedNum <= last_marker) continue; // skip already processed
        await db.run(
          `INSERT INTO vod_items (xtream_vod_id, title_original, title_normalized, category_id, stream_icon, added_at_xtream, container_extension)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(xtream_vod_id) DO UPDATE SET
             title_original=excluded.title_original,
             title_normalized=excluded.title_normalized,
             category_id=excluded.category_id,
             stream_icon=excluded.stream_icon,
             added_at_xtream=excluded.added_at_xtream,
             container_extension=excluded.container_extension`,
          m.stream_id,
          m.name,
          m.name.toLowerCase(),
          m.category_id,
          m.stream_icon || null,
          addedNum,
          m.container_extension || null
        );
        upserted++;
        if (addedNum > maxAdded) maxAdded = addedNum;
      }
      logger.info({ processed, upserted }, 'syncMovies: finished movie loop');
      // Record sync run
      await db.run(
        `INSERT INTO sync_runs (started_at, finished_at, status, inserted, updated, skipped, errors_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        new Date().toISOString(),
        new Date().toISOString(),
        'success',
        maxAdded,
        0,
        0,
        null
      );
      logger.info(`Upserted ${upserted} movies (incremental, marker=${maxAdded}).`);
      return upserted;
    } catch (err) {
      logger.error({ err }, 'Failed to sync movies');
      throw err;
    }
  }

  async enrichWithTmdb() {
    const db = await getDb();
    const movies = await db.all('SELECT * FROM vod_items');
    let enriched = 0;
    let idx = 0;
    for (const movie of movies) {
      idx++;
      logger.info({ idx, total: movies.length, title: movie.title_original }, 'Enriching movie with TMDB');
      const query = encodeURIComponent(movie.title_original);
      const tmdbUrl = `${config.tmdb.baseUrl}/search/movie?api_key=${config.tmdb.apiKey}&query=${query}`;
      try {
        const res = await httpGet(tmdbUrl, { timeoutMs: 10000 });
        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
        const data = await res.json();
        if (!data || !Array.isArray(data.results)) throw new Error('Invalid TMDB response');
        let chosen: any = null;
        if (data.results.length === 1) {
          chosen = data.results[0];
        } else if (data.results.length > 1) {
          // Heuristic: prefer exact (case-insensitive) title match
          const normTitle = (movie.title_original || '').trim().toLowerCase();
          let candidates = data.results;
          let exactMatches = candidates.filter((c: any) => (c.title || '').trim().toLowerCase() === normTitle);
          if (exactMatches.length === 1) {
            chosen = exactMatches[0];
          } else if (exactMatches.length > 1) {

            const xtreamYear = movie.added_at_xtream ? new Date(movie.added_at_xtream * 1000).getFullYear() : null;
            let yearMatches = exactMatches.filter((c: any) => c.release_date && xtreamYear && new Date(c.release_date).getFullYear() === xtreamYear);
            if (yearMatches.length === 1) {
              chosen = yearMatches[0];
            } else if (yearMatches.length > 1) {
              // Prefer highest vote_average
              chosen = yearMatches.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            } else {
              // No year match, pick highest vote_average among exact
              chosen = exactMatches.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            }
          } else {
            // No exact match, try by year
            const xtreamYear = movie.added_at_xtream ? new Date(movie.added_at_xtream * 1000).getFullYear() : null;
            let yearMatches = candidates.filter((c: any) => c.release_date && xtreamYear && new Date(c.release_date).getFullYear() === xtreamYear);
            if (yearMatches.length === 1) {
              chosen = yearMatches[0];
            } else if (yearMatches.length > 1) {
              chosen = yearMatches.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            } else {
              // Fallback: pick highest vote_average overall
              chosen = candidates.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            }
          }
          // Confidence threshold: if vote_average < 4 or no title match, mark ambiguous
          if (!chosen || (chosen.vote_average !== undefined && chosen.vote_average < 4)) {
            chosen = null;
          }
        }
        if (chosen) {
          const tmdbId = chosen.id;
          const detailsUrl = `${config.tmdb.baseUrl}/movie/${tmdbId}?api_key=${config.tmdb.apiKey}`;
          const detailsRes = await httpGet(detailsUrl, { timeoutMs: 10000 });
          if (!detailsRes.ok) throw new Error(`TMDB details error: ${detailsRes.status}`);
          const details = await detailsRes.json();
          // Discrepancy tracking
          const discrepancies: any = {};
          if (movie.title_original && details.original_title && movie.title_original !== details.original_title) {
            discrepancies.title = { xtream: movie.title_original, tmdb: details.original_title };
          }
          if (movie.added_at_xtream && details.release_date) {
            const xtreamYear = new Date(movie.added_at_xtream * 1000).getFullYear();
            const tmdbYear = new Date(details.release_date).getFullYear();
            if (xtreamYear !== tmdbYear) {
              discrepancies.year = { xtream: xtreamYear, tmdb: tmdbYear };
            }
          }
          // Genres (compare as sets)
          if (details.genres) {
            const tmdbGenres = Array.isArray(details.genres) ? details.genres.map((g: any) => g.name).sort() : [];
            // No genre in xtream, so just log tmdb genres
            discrepancies.genres = { tmdb: tmdbGenres };
          }
          if (Object.keys(discrepancies).length > 0) {
            logger.warn({ movie: movie.title_original, discrepancies }, 'Discrepancy detected between Xtream and TMDB');
          }
          await db.run(
            `INSERT OR REPLACE INTO tmdb_movies (
              vod_item_id, tmdb_id, overview, poster_path, backdrop_path, release_date, runtime, vote_average, genres, original_title, original_language, spoken_languages, production_companies, production_countries, budget, revenue, keywords, homepage, status, discrepancies_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            movie.id,
            details.id,
            details.overview || null,
            details.poster_path || null,
            details.backdrop_path || null,
            details.release_date || null,
            details.runtime || null,
            details.vote_average || null,
            details.genres ? JSON.stringify(details.genres) : null,
            details.original_title || null,
            details.original_language || null,
            details.spoken_languages ? JSON.stringify(details.spoken_languages) : null,
            details.production_companies ? JSON.stringify(details.production_companies) : null,
            details.production_countries ? JSON.stringify(details.production_countries) : null,
            details.budget || null,
            details.revenue || null,
            details.keywords ? JSON.stringify(details.keywords) : null,
            details.homepage || null,
            details.status || null,
            Object.keys(discrepancies).length > 0 ? JSON.stringify(discrepancies) : null
          );
          // Mark as not ambiguous and clear any previous candidates
          await db.run('UPDATE vod_items SET is_ambiguous = 0 WHERE id = ?', movie.id);
          await db.run('DELETE FROM tmdb_candidates WHERE vod_item_id = ?', movie.id);
          enriched++;
        } else if (data.results.length > 0) {
          // Ambiguous: store candidates and mark as ambiguous
          await db.run(
            `INSERT OR REPLACE INTO tmdb_candidates (vod_item_id, candidate_json) VALUES (?, ?)`,
            movie.id,
            JSON.stringify(data.results)
          );
          await db.run('UPDATE vod_items SET is_ambiguous = 1 WHERE id = ?', movie.id);
          logger.warn({ movie: movie.title_original }, 'Ambiguous TMDB match, candidates stored');
        } else {
          // No match: clear ambiguity/candidates
          await db.run('UPDATE vod_items SET is_ambiguous = 0 WHERE id = ?', movie.id);
          await db.run('DELETE FROM tmdb_candidates WHERE vod_item_id = ?', movie.id);
          logger.warn({ movie: movie.title_original }, 'No TMDB match found');
        }
      } catch (err) {
        logger.error({ err, movie: movie.title_original }, 'Failed to enrich with TMDB');
      }
    }
    logger.info(`Enriched ${enriched} movies with TMDB data.`);
    return enriched;
  }

  async runFullSync() {
    logger.info('Starting full sync...');
    const stats: any = { categories: 0, movies: 0, enriched: 0, ambiguous: 0, errors: [] };
    try {
      stats.categories = await this.syncCategories();
      stats.movies = await this.syncMovies();
      logger.info('Starting TMDB enrichment...');
      stats.enriched = await this.enrichWithTmdb();
      logger.info('Finished TMDB enrichment.');
      // Count ambiguous
      const db = await getDb();
      const amb = await db.get('SELECT COUNT(*) as count FROM vod_items WHERE is_ambiguous = 1');
      stats.ambiguous = amb ? amb.count : 0;
      logger.info({ stats }, 'Full sync completed');
    } catch (err) {
      logger.error({ err }, 'Full sync failed');
      stats.errors.push((err as Error).message);
    }
    return stats;
  }

  async handleAmbiguity() {
    logger.info('Handling ambiguous movies...');
    const db = await getDb();
    const ambiguous = await db.all('SELECT * FROM vod_items WHERE is_ambiguous = 1');
    let resolved = 0;
    for (const movie of ambiguous) {
      // Re-run the TMDB heuristic for this movie only
      const query = encodeURIComponent(movie.title_original);
      const tmdbUrl = `${config.tmdb.baseUrl}/search/movie?api_key=${config.tmdb.apiKey}&query=${query}`;
      try {
        const res = await httpGet(tmdbUrl, { timeoutMs: 10000 });
        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
        const data = await res.json();
        if (!data || !Array.isArray(data.results)) throw new Error('Invalid TMDB response');
        let chosen: any = null;
        if (data.results.length === 1) {
          chosen = data.results[0];
        } else if (data.results.length > 1) {
          const normTitle = (movie.title_original || '').trim().toLowerCase();
          let candidates = data.results;
          let exactMatches = candidates.filter((c: any) => (c.title || '').trim().toLowerCase() === normTitle);
          if (exactMatches.length === 1) {
            chosen = exactMatches[0];
          } else if (exactMatches.length > 1) {
            const xtreamYear = movie.added_at_xtream ? new Date(movie.added_at_xtream * 1000).getFullYear() : null;
            let yearMatches = exactMatches.filter((c: any) => c.release_date && xtreamYear && new Date(c.release_date).getFullYear() === xtreamYear);
            if (yearMatches.length === 1) {
              chosen = yearMatches[0];
            } else if (yearMatches.length > 1) {
              chosen = yearMatches.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            } else {
              chosen = exactMatches.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            }
          } else {
            const xtreamYear = movie.added_at_xtream ? new Date(movie.added_at_xtream * 1000).getFullYear() : null;
            let yearMatches = candidates.filter((c: any) => c.release_date && xtreamYear && new Date(c.release_date).getFullYear() === xtreamYear);
            if (yearMatches.length === 1) {
              chosen = yearMatches[0];
            } else if (yearMatches.length > 1) {
              chosen = yearMatches.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            } else {
              chosen = candidates.sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))[0];
            }
          }
          if (!chosen || (chosen.vote_average !== undefined && chosen.vote_average < 4)) {
            chosen = null;
          }
        }
        if (chosen) {

          const tmdbId = chosen.id;
          const detailsUrl = `${config.tmdb.baseUrl}/movie/${tmdbId}?api_key=${config.tmdb.apiKey}`;
          const detailsRes = await httpGet(detailsUrl, { timeoutMs: 10000 });
          if (!detailsRes.ok) throw new Error(`TMDB details error: ${detailsRes.status}`);
          const details = await detailsRes.json();
          await db.run(
            `INSERT OR REPLACE INTO tmdb_movies (
              vod_item_id, tmdb_id, overview, poster_path, backdrop_path, release_date, runtime, vote_average, genres, original_title, original_language, spoken_languages, production_companies, production_countries, budget, revenue, keywords, homepage, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            movie.id,
            details.id,
            details.overview || null,
            details.poster_path || null,
            details.backdrop_path || null,
            details.release_date || null,
            details.runtime || null,
            details.vote_average || null,
            details.genres ? JSON.stringify(details.genres) : null,
            details.original_title || null,
            details.original_language || null,
            details.spoken_languages ? JSON.stringify(details.spoken_languages) : null,
            details.production_companies ? JSON.stringify(details.production_companies) : null,
            details.production_countries ? JSON.stringify(details.production_countries) : null,
            details.budget || null,
            details.revenue || null,
            details.keywords ? JSON.stringify(details.keywords) : null,
            details.homepage || null,
            details.status || null
          );
          await db.run('UPDATE vod_items SET is_ambiguous = 0 WHERE id = ?', movie.id);
          await db.run('DELETE FROM tmdb_candidates WHERE vod_item_id = ?', movie.id);
          resolved++;
        }
      } catch (err) {
        logger.error({ err, movie: movie.title_original }, 'Failed to resolve ambiguity');
      }
    }
    logger.info(`Resolved ${resolved} ambiguous movies.`);
    return resolved;
  }
}
