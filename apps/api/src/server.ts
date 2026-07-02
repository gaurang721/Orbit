import { createServer, type Server } from 'node:http';
import type { Express } from 'express';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { connectPrisma, disconnectPrisma } from './lib/prisma.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { initSocket } from './socket/index.js';
import { storiesService } from './modules/stories/stories.service.js';
import { postsRepository } from './modules/posts/posts.repository.js';

export async function startServer(app: Express): Promise<Server> {
  // Establish infra connections before accepting traffic.
  // In production a failed DB connection is fatal (fail fast). In development we
  // log and continue so the server still boots for inspection (health, Swagger)
  // even when Postgres isn't available yet.
  await connectRedis();
  try {
    await connectPrisma();
  } catch (err) {
    if (env.isProd) throw err;
    logger.warn(
      { err: (err as Error).message },
      '⚠️  Could not connect to PostgreSQL — booting in degraded mode. DB-backed endpoints will fail until a database is available.',
    );
  }

  const server = createServer(app);
  initSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(env.API_PORT, () => {
      logger.info(`🚀 API listening on ${env.API_URL} (env: ${env.NODE_ENV})`);
      logger.info(`📚 Swagger docs at ${env.API_URL}/api/docs`);
      resolve();
    });
  });

  // Purge expired stories hourly (stories also disappear from queries immediately).
  const purge = () =>
    void storiesService
      .purgeExpired()
      .then((n) => n > 0 && logger.debug(`Purged ${n} expired stories`))
      .catch((err) => logger.warn({ err }, 'Story purge failed'));
  purge();
  setInterval(purge, 60 * 60 * 1000).unref();

  // Publish scheduled posts whose time has arrived (checked every 30s).
  const publishDue = () =>
    void postsRepository
      .publishDueScheduledPosts(new Date())
      .then((n) => n > 0 && logger.debug(`Published ${n} scheduled post(s)`))
      .catch((err) => logger.warn({ err }, 'Scheduled-post publish failed'));
  publishDue();
  setInterval(publishDue, 30 * 1000).unref();

  registerShutdown(server);
  return server;
}

function registerShutdown(server: Server): void {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => logger.info('HTTP server closed'));
    try {
      await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}
