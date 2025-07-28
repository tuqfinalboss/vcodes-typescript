import client from 'prom-client';
import pinoHttp from 'pino-http';
import logger from '../infra/logger';
import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';

// --- Redis client for rate limiting ---
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// --- Prometheus metrics setup ---
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

export const httpRequestCounter = new client.Counter({
  name: 'vod_api_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

export const httpRequestDuration = new client.Histogram({
  name: 'vod_api_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5]
});

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    const route = req.route && req.route.path ? req.route.path : req.path;
    httpRequestCounter.inc({ method: req.method, route, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route, status: res.statusCode }, duration);
  });
  next();
};

export const loggingMiddleware = pinoHttp({ logger });

export const rateLimit = (limit = 60, windowSec = 60) => async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `rl:${req.path}:${ip}`;
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSec);
  }
  if (current > limit) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  next();
};
