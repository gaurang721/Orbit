import { Router } from 'express';
import type { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { createGroupSchema, createPostSchema, updateGroupSchema, type CreatePostInput, type GroupDTO, type UpdateGroupInput } from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadImages } from '../../middleware/upload.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { slugify } from '../../lib/selects.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { errors } from '../../utils/http-error.js';
import { sendSuccess } from '../../utils/response.js';
import { postsService } from '../posts/posts.service.js';

const router: Router = Router();
router.use(requireAuth);

type GroupRow = { id: string; name: string; slug: string; description: string | null; privacy: 'PUBLIC' | 'PRIVATE' | 'SECRET'; coverPhoto: string | null; memberCount: number; createdAt: Date };

function toDTO(g: GroupRow, member: { role: 'MEMBER' | 'MODERATOR' | 'ADMIN' } | null): GroupDTO {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    privacy: g.privacy,
    coverPhoto: g.coverPhoto,
    memberCount: g.memberCount,
    isMember: !!member,
    myRole: member?.role ?? null,
    createdAt: g.createdAt.toISOString(),
  };
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groups = await prisma.group.findMany({ where: { privacy: { not: 'SECRET' } }, orderBy: { createdAt: 'desc' }, take: 50 });
  const myMemberships = await prisma.groupMember.findMany({ where: { userId: me, groupId: { in: groups.map((g) => g.id) } } });
  const byGroup = new Map(myMemberships.map((m) => [m.groupId, m]));
  sendSuccess(res, { groups: groups.map((g) => toDTO(g, byGroup.get(g.id) ?? null)) });
}));

router.post('/', validate(createGroupSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const { name, description, privacy } = req.body as { name: string; description?: string; privacy: 'PUBLIC' | 'PRIVATE' };
  const group = await prisma.group.create({
    data: {
      name,
      slug: slugify(name, nanoid(6)),
      description,
      privacy,
      createdById: me,
      memberCount: 1,
      members: { create: { userId: me, role: 'ADMIN' } },
    },
  });
  sendSuccess(res, { group: toDTO(group, { role: 'ADMIN' }) }, 201);
}));

router.get('/:slug', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const group = await prisma.group.findUnique({ where: { slug: req.params.slug! } });
  if (!group) throw errors.notFound('Group not found');
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: me } } });
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, verified: true } } },
    take: 30,
    orderBy: { joinedAt: 'asc' },
  });
  sendSuccess(res, { group: toDTO(group, member ? { role: member.role } : null), members: members.map((m) => ({ ...m.user, role: m.role })) });
}));

// ----- Group posts (in-context feed) ----------------------------------------
// Anyone can read a PUBLIC group's posts; private/secret groups are members-only.
// Only members can publish to a group.
router.get('/:id/posts', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groupId = req.params.id!;
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { privacy: true } });
  if (!group) throw errors.notFound('Group not found');
  if (group.privacy !== 'PUBLIC') {
    const member = await prisma.groupMember.count({ where: { groupId, userId: me } });
    if (member === 0) throw errors.forbidden('Join this group to see its posts');
  }
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const page = await postsService.getGroupPosts(me, groupId, cursor, Number(limit) || 10);
  sendSuccess(res, page);
}));

router.post('/:id/posts', uploadImages, validate(createPostSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groupId = req.params.id!;
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw errors.notFound('Group not found');
  const member = await prisma.groupMember.count({ where: { groupId, userId: me } });
  if (member === 0) throw errors.forbidden('Only members can post in this group');
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const post = await postsService.create(me, req.body as CreatePostInput, files, { groupId });
  sendSuccess(res, { post }, 201);
}));

router.post('/:id/join', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const group = await prisma.group.findUnique({ where: { id: req.params.id! } });
  if (!group) throw errors.notFound('Group not found');
  const existing = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: me } } });
  if (existing) return sendSuccess(res, { joined: true });
  if (group.privacy === 'PUBLIC') {
    await prisma.$transaction([
      prisma.groupMember.create({ data: { groupId: group.id, userId: me, role: 'MEMBER' } }),
      prisma.group.update({ where: { id: group.id }, data: { memberCount: { increment: 1 } } }),
    ]);
    return sendSuccess(res, { joined: true });
  }
  await prisma.groupJoinRequest.upsert({
    where: { groupId_userId: { groupId: group.id, userId: me } },
    create: { groupId: group.id, userId: me },
    update: {},
  });
  sendSuccess(res, { joined: false, requested: true });
}));

/** Edit group details (admins only). */
router.patch('/:id', validate(updateGroupSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groupId = req.params.id!;
  await assertGroupAdmin(groupId, me);
  const b = req.body as UpdateGroupInput;
  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(b.name !== undefined ? { name: b.name } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.privacy !== undefined ? { privacy: b.privacy } : {}),
    },
  });
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: me } } });
  sendSuccess(res, { group: toDTO(group, member ? { role: member.role } : null) });
}));

/** Delete a group and its posts/members (admins only). */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const group = await prisma.group.findUnique({ where: { id: req.params.id! }, select: { id: true } });
  if (!group) throw errors.notFound('Group not found');
  await assertGroupAdmin(group.id, me);
  await prisma.group.delete({ where: { id: group.id } });
  sendSuccess(res, { ok: true });
}));

router.post('/:id/leave', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const deleted = await prisma.groupMember.deleteMany({ where: { groupId: req.params.id!, userId: me } });
  if (deleted.count > 0) await prisma.group.update({ where: { id: req.params.id! }, data: { memberCount: { decrement: 1 } } });
  sendSuccess(res, { ok: true });
}));

// ----- Admin: join requests + member management -----------------------------
/** Assert the acting user is an ADMIN of the group; returns the group id. */
async function assertGroupAdmin(groupId: string, userId: string): Promise<void> {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!member || member.role !== 'ADMIN') throw errors.forbidden('Only group admins can do that');
}

const memberUserSelect = { id: true, firstName: true, lastName: true, username: true, profilePicture: true, verified: true };

/** Pending join requests for a private group (admins only). */
router.get('/:id/requests', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  await assertGroupAdmin(req.params.id!, me);
  const requests = await prisma.groupJoinRequest.findMany({
    where: { groupId: req.params.id!, status: 'PENDING' },
    include: { user: { select: memberUserSelect } },
    orderBy: { createdAt: 'asc' },
  });
  sendSuccess(res, { requests: requests.map((r) => ({ id: r.id, user: r.user, createdAt: r.createdAt.toISOString() })) });
}));

/** Approve a pending join request → add the user as a member. */
router.post('/:id/requests/:userId/approve', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groupId = req.params.id!;
  await assertGroupAdmin(groupId, me);
  const targetId = req.params.userId!;
  const request = await prisma.groupJoinRequest.findUnique({ where: { groupId_userId: { groupId, userId: targetId } } });
  if (!request || request.status !== 'PENDING') throw errors.notFound('Request not found');
  const already = await prisma.groupMember.count({ where: { groupId, userId: targetId } });
  await prisma.$transaction([
    prisma.groupJoinRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } }),
    ...(already === 0
      ? [
          prisma.groupMember.create({ data: { groupId, userId: targetId, role: 'MEMBER' } }),
          prisma.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } }),
        ]
      : []),
  ]);
  sendSuccess(res, { approved: true });
}));

/** Reject a pending join request. */
router.post('/:id/requests/:userId/reject', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groupId = req.params.id!;
  await assertGroupAdmin(groupId, me);
  await prisma.groupJoinRequest.updateMany({
    where: { groupId, userId: req.params.userId!, status: 'PENDING' },
    data: { status: 'REJECTED' },
  });
  sendSuccess(res, { rejected: true });
}));

/** Remove a member from the group (admins only; can't remove yourself here). */
router.post('/:id/members/:userId/remove', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groupId = req.params.id!;
  await assertGroupAdmin(groupId, me);
  const targetId = req.params.userId!;
  if (targetId === me) throw errors.badRequest('Use "leave" to remove yourself');
  const deleted = await prisma.groupMember.deleteMany({ where: { groupId, userId: targetId } });
  if (deleted.count > 0) await prisma.group.update({ where: { id: groupId }, data: { memberCount: { decrement: 1 } } });
  sendSuccess(res, { removed: true });
}));

/** Change a member's role (admins only). */
router.post('/:id/members/:userId/role', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const groupId = req.params.id!;
  await assertGroupAdmin(groupId, me);
  const role = (req.body as { role?: string }).role;
  if (role !== 'MEMBER' && role !== 'MODERATOR' && role !== 'ADMIN') throw errors.badRequest('Invalid role');
  await prisma.groupMember.updateMany({ where: { groupId, userId: req.params.userId! }, data: { role } });
  sendSuccess(res, { role });
}));

export const groupsRouter = router;
