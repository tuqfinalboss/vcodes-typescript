// Migration to add discrepancies_json column to tmdb_movies
// Up: add column

module.exports = {
  up: async function up(db) {
    await db.run(`ALTER TABLE tmdb_movies ADD COLUMN discrepancies_json TEXT`);
  },
  down: async function down(db) {
  }
};
