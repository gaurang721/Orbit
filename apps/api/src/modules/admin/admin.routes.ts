import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  banUserSchema,
  createReportSchema,
  resolveReportSchema,
  setRoleSchema,
  type AdminUserDTO,
  type AuditLogDTO,
  type ReportDTO,
} from '@fbclone/types';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { sendSuccess } from '../../utils/response.js';
import { errors } from '../../utils/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { userRefSelect } from '../../lib/selects.js';

// ---------------------------------------------------------------------------
// Selections + DTO mappers
// ---------------------------------------------------------------------------

const adminUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  profilePicture: true,
  role: true,
  verified: true,
  isActive: true,
  isBanned: true,
  bannedUntil: true,
  createdAt: true,
  lastSeenAt: true,
} satisfies Prisma.UserSelect;

type ReportRow = Prisma.ReportGetPayload<{
  include: { reporter: { select: typeof userRefSelect }; resolvedBy: { select: typeof userRefSelect } };
}>;
type UserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;
type AuditRow = Prisma.AuditLogGetPayload<{ include: { actor: { select: typeof userRefSelect } } }>;

function toReportDTO(r: ReportRow): ReportDTO {
  return {
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    description: r.description,
    status: r.status,
    reporter: r.reporter,
    resolvedBy: r.resolvedBy,
    resolutionNote: r.resolutionNote,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function toAdminUserDTO(u: UserRow): AdminUserDTO {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    profilePicture: u.profilePicture,
    role: u.role,
    verified: u.verified,
    isActive: u.isActive,
    isBanned: u.isBanned,
    bannedUntil: u.bannedUntil?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
  };
}

function toAuditDTO(a: AuditRow): AuditLogDTO {
  return {
    id: a.id,
    actor: a.actor,
    action: a.action,
    entity: a.entity,
    entityId: a.entityId,
    metadata: a.metadata,
    ip: a.ip,
    createdAt: a.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public reporting: any authenticated user can file a report
// ---------------------------------------------------------------------------

const reports: Router = Router();
reports.use(requireAuth);

reports.post(
  '/',
  validate(createReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof createReportSchema>;
    const report = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        description: body.description,
      },
    });
    await audit({
      actorId: req.user!.id,
      action: 'report.create',
      entity: body.targetType,
      entityId: body.targetId,
      metadata: { reason: body.reason },
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
    });
    sendSuccess(res, { id: report.id }, 201);
  }),
);

export const reportsRouter = reports;

// ---------------------------------------------------------------------------
// Admin / moderation dashboard — MODERATOR and above
// ---------------------------------------------------------------------------

const admin: Router = Router();
admin.use(requireAuth, requireRole('MODERATOR'));

// ----- Dashboard stats -----
admin.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalUsers, bannedUsers, totalPosts, pendingReports] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.post.count(),
      prisma.report.count({ where: { status: 'PENDING' } }),
    ]);
    sendSuccess(res, { totalUsers, bannedUsers, totalPosts, pendingReports });
  }),
);

// ----- Reports queue -----
const reportsQuery = z.object({
  status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

admin.get(
  '/reports',
  validate(reportsQuery, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, cursor, limit } = req.query as unknown as z.infer<typeof reportsQuery>;
    const where: Prisma.ReportWhereInput = status ? { status } : {};
    const rows = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { reporter: { select: userRefSelect }, resolvedBy: { select: userRefSelect } },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toReportDTO);
    sendSuccess(res, { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null, hasMore });
  }),
);

admin.patch(
  '/reports/:id',
  validate(resolveReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof resolveReportSchema>;
    const existing = await prisma.report.findUnique({ where: { id: req.params.id! }, select: { id: true } });
    if (!existing) throw errors.notFound('Report not found');
    const resolved = body.status === 'RESOLVED' || body.status === 'DISMISSED';
    const row = await prisma.report.update({
      where: { id: req.params.id! },
      data: {
        status: body.status,
        resolutionNote: body.resolutionNote,
        resolvedById: resolved ? req.user!.id : null,
        resolvedAt: resolved ? new Date() : null,
      },
      include: { reporter: { select: userRefSelect }, resolvedBy: { select: userRefSelect } },
    });
    await audit({
      actorId: req.user!.id,
      action: `report.${body.status.toLowerCase()}`,
      entity: 'Report',
      entityId: row.id,
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
    });
    sendSuccess(res, { report: toReportDTO(row) });
  }),
);

// ----- Users management -----
const usersQuery = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['all', 'banned', 'active']).default('all'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

admin.get(
  '/users',
  validate(usersQuery, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, status, cursor, limit } = req.query as unknown as z.infer<typeof usersQuery>;
    const where: Prisma.UserWhereInput = {};
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (status === 'banned') where.isBanned = true;
    if (status === 'active') where.isBanned = false;

    const rows = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: adminUserSelect,
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toAdminUserDTO);
    sendSuccess(res, { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null, hasMore });
  }),
);

// Ban / unban — ADMIN and above
admin.patch(
  '/users/:id/ban',
  requireRole('ADMIN'),
  validate(banUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof banUserSchema>;
    const id = req.params.id!;
    if (id === req.user!.id) throw errors.badRequest("You can't ban yourself");
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw errors.notFound('User not found');
    if (target.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw errors.forbidden('Only a super admin can ban a super admin');
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        isBanned: body.banned,
        bannedUntil: body.banned && body.until ? new Date(body.until) : null,
      },
      select: adminUserSelect,
    });
    await audit({
      actorId: req.user!.id,
      action: body.banned ? 'user.ban' : 'user.unban',
      entity: 'User',
      entityId: id,
      metadata: { reason: body.reason, until: body.until },
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
    });
    sendSuccess(res, { user: toAdminUserDTO(updated) });
  }),
);

// Change role — SUPER_ADMIN only
admin.patch(
  '/users/:id/role',
  requireRole('SUPER_ADMIN'),
  validate(setRoleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof setRoleSchema>;
    const id = req.params.id!;
    if (id === req.user!.id) throw errors.badRequest("You can't change your own role");
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) throw errors.notFound('User not found');
    const updated = await prisma.user.update({ where: { id }, data: { role: body.role }, select: adminUserSelect });
    await audit({
      actorId: req.user!.id,
      action: 'user.role',
      entity: 'User',
      entityId: id,
      metadata: { role: body.role },
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
    });
    sendSuccess(res, { user: toAdminUserDTO(updated) });
  }),
);

// ----- Audit log — ADMIN and above -----
const auditQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

admin.get(
  '/audit',
  requireRole('ADMIN'),
  validate(auditQuery, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit } = req.query as unknown as z.infer<typeof auditQuery>;
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { actor: { select: userRefSelect } },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toAuditDTO);
    sendSuccess(res, { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null, hasMore });
  }),
);

export const adminRouter = admin;
