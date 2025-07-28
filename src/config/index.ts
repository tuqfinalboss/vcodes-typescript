import dotenv from 'dotenv';
dotenv.config();

export const config = {
  dbPath: process.env.DB_PATH || 'vod-api.db',
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
  },
  xtream: {
    baseUrl: process.env.XTREAM_BASE_URL || '',
    username: process.env.XTREAM_USERNAME || '',
    password: process.env.XTREAM_PASSWORD || '',
  },
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || '',
    baseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
};
