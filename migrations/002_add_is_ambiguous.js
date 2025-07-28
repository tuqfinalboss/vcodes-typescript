// 002_add_is_ambiguous.js - Add is_ambiguous column to vod_items
module.exports = {
  up: async function up(db) {
    await db.run('ALTER TABLE vod_items ADD COLUMN is_ambiguous INTEGER DEFAULT 0');
  },
  down: async function down(db) {
  }
};
