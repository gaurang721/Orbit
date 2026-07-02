import type { Request } from 'express';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

interface AuditInput {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/** Persist an audit-log entry. Never throws — auditing must not break the request. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata as never,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  } catch (err) {
    logger.warn({ err, action: input.action }, 'Failed to write audit log');
  }
}

/** Convenience wrapper that pulls ip/user-agent off an Express request. */
export async function auditFromRequest(
  req: Request,
  action: string,
  extra: Omit<AuditInput, 'action' | 'ip' | 'userAgent'> = {},
): Promise<void> {
  await audit({
    ...extra,
    action,
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  });
}
