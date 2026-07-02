import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { globalRateLimiter } from './middleware/rate-limit.middleware.js';
import { requestContext } from './middleware/request-context.js';
import { verifyOrigin } from './middleware/security.middleware.js';
import { apiRouter } from './routes/index.js';
import { mountSwagger } from './docs/swagger.js';
import { UPLOAD_DIR, UPLOAD_ROUTE } from './lib/storage.js';

export function createApp(): Express {
  const app = express();

  // Trust the reverse proxy (nginx) so req.ip and secure cookies work.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ----- Security headers (Helmet) ------------------------------------------
  app.use(
    helmet({
      // The API serves JSON + Swagger UI; relax CSP only for the docs route.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // ----- CORS ----------------------------------------------------------------
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Device-Name', 'X-CSRF'],
    }),
  );

  // ----- Parsers & misc ------------------------------------------------------
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(compression());
  app.use(requestContext);
  app.use(verifyOrigin);

  // ----- Request logging -----------------------------------------------------
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { id?: string }).id ?? 'unknown',
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
    }),
  );

  // ----- Static media (local-disk uploads) -----------------------------------
  // Uploads are validated by magic bytes on the way in; these headers are
  // defense-in-depth so the browser can never sniff/execute a stored file as
  // active content (e.g. HTML/JS) even if one slipped through.
  app.use(
    UPLOAD_ROUTE,
    express.static(UPLOAD_DIR, {
      maxAge: '7d',
      immutable: true,
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    }),
  );

  // ----- API documentation ---------------------------------------------------
  mountSwagger(app);

  // ----- Routes --------------------------------------------------------------
  app.use('/api/v1', globalRateLimiter, apiRouter);

  // ----- 404 + error handler -------------------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
