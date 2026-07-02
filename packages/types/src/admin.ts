import { z } from 'zod';
import type { UserRef } from './user';
import type { Role, ReportStatus, ReportTargetType } from './enums';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

/** Any authenticated user can file a report against a piece of content/user. */
export const createReportSchema = z.object({
  targetType: z.enum(['USER', 'POST', 'COMMENT', 'MESSAGE', 'GROUP', 'PAGE', 'PRODUCT', 'STORY']),
  targetId: z.string().min(1),
  reason: z.string().trim().min(1, 'A reason is required').max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

/** Moderators move a report through its lifecycle. */
export const resolveReportSchema = z.object({
  status: z.enum(['REVIEWING', 'RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().trim().max(2000).optional(),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

/** Ban or unban a user. `until` (ISO date) makes it a temporary ban. */
export const banUserSchema = z.object({
  banned: z.boolean(),
  until: z.string().datetime().optional(),
  reason: z.string().trim().max(500).optional(),
});
export type BanUserInput = z.infer<typeof banUserSchema>;

/** Change a user's platform role. */
export const setRoleSchema = z.object({
  role: z.enum(['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']),
});
export type SetRoleInput = z.infer<typeof setRoleSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ReportDTO {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  reporter: UserRef;
  resolvedBy: UserRef | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AdminUserDTO {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  profilePicture: string | null;
  role: Role;
  verified: boolean;
  isActive: boolean;
  isBanned: boolean;
  bannedUntil: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface AuditLogDTO {
  id: string;
  actor: UserRef | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AdminStatsDTO {
  totalUsers: number;
  bannedUsers: number;
  totalPosts: number;
  pendingReports: number;
}
