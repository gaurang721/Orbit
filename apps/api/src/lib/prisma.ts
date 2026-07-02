import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Reuse a single PrismaClient across hot-reloads in development to avoid
// exhausting the connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDev ? ['warn', 'error'] : ['error'],
  });

if (env.isDev) globalForPrisma.prisma = prisma;

export async function connectPrisma(): Promise<void> {
  await prisma.$connect();
  logger.info('✅ PostgreSQL connected');
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
}
