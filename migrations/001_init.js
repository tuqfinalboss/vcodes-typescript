// 001_init.js - Initial schema migration
module.exports = {
  up: async function up(db) {
    // VOD Categories
    await db.run(`CREATE TABLE IF NOT EXISTS vod_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      xtream_category_id TEXT NOT NULL UNIQUE
    )`);
    // VOD Items
    await db.run(`CREATE TABLE IF NOT EXISTS vod_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      xtream_vod_id INTEGER NOT NULL UNIQUE,
      title_original TEXT NOT NULL,
      title_normalized TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      stream_icon TEXT,
      added_at_xtream INTEGER NOT NULL,
      container_extension TEXT,
      FOREIGN KEY (category_id) REFERENCES vod_categories(id)
    )`);
    // TMDB Movies
    await db.run(`CREATE TABLE IF NOT EXISTS tmdb_movies (
      vod_item_id INTEGER PRIMARY KEY,
      tmdb_id INTEGER NOT NULL,
      overview TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      release_date TEXT,
      runtime INTEGER,
      vote_average REAL,
      genres TEXT,
      original_title TEXT,
      original_language TEXT,
      spoken_languages TEXT,
      production_companies TEXT,
      production_countries TEXT,
      budget INTEGER,
      revenue INTEGER,
      keywords TEXT,
      homepage TEXT,
      status TEXT,
      FOREIGN KEY (vod_item_id) REFERENCES vod_items(id)
    )`);
    // Sync Runs
    await db.run(`CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      inserted INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      skipped INTEGER NOT NULL,
      errors_json TEXT
    )`);
    // TMDB Candidates
    await db.run(`CREATE TABLE IF NOT EXISTS tmdb_candidates (
      vod_item_id INTEGER PRIMARY KEY,
      candidate_json TEXT NOT NULL,
      FOREIGN KEY (vod_item_id) REFERENCES vod_items(id)
    )`);
  },
  down: async function down(db) {
  }
};
