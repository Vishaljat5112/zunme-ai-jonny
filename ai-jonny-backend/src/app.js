import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { apiRouter } from './routes/apiRouter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { observabilityMiddleware } from './middleware/observabilityMiddleware.js';

export function createApp() {
  const app = express();

  // Observability & Request Correlation
  app.use(observabilityMiddleware);

  // CORS configuration (Supporting internal Chatbot UI and external Software Integrations)
  app.use(
    cors({
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-User-Id',
        'x-user-id',
        'X-Guest-Mode',
        'x-guest-mode',
        'x-software-id',
        'x-integration-key',
        'x-software-token',
        'x-tenant-id',
        'x-api-key',
        'x-request-id',
        'x-correlation-id',
        'Accept',
        'Origin',
        'X-Requested-With'
      ],
      exposedHeaders: ['Content-Type', 'Authorization', 'X-Accel-Buffering'],
      credentials: true
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Basic request logger in dev
  if (config.env === 'development') {
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
  }

  // Mount API router
  app.use('/api', apiRouter);

  // 404 Handler for API routes
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
