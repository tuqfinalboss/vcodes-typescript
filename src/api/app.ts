


import express from 'express';
import swaggerUi from 'swagger-ui-express';
import openApiSpec from './openapi';
import { metricsMiddleware, loggingMiddleware } from './middleware';
import categoriesRouter from './routes/categories';
import moviesRouter from './routes/movies';
import playlistRouter from './routes/playlist';
import adminRouter from './routes/admin';
import metricsRouter from './routes/metrics';

const app = express();

// --- Middleware ---
app.use(metricsMiddleware);
app.use(loggingMiddleware);

// --- Docs & Meta Endpoints ---
app.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- API Routes ---
app.use('/v1/categories', categoriesRouter);
app.use('/v1/movies', moviesRouter);
app.use('/v1/playlist.m3u', playlistRouter);
app.use('/v1/admin', adminRouter);
app.use('/v1/metrics', metricsRouter);

export default app;
