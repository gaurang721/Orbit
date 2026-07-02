import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ProfileDTO, PublicUser, UpdateProfileInput } from '@fbclone/types';
import { updateProfileSchema } from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadSingleImage } from '../../middleware/upload.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { publicUrl } from '../../lib/storage.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { errors } from '../../utils/http-error.js';
import { sendSuccess } from '../../utils/response.js';
import { friendsService } from '../friends/friends.service.js';
import { postsService } from '../posts/posts.service.js';
import { toCurrentUser } from '../auth/auth.service.js';

const router: Router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /users/contacts:
 *   get:
 *     tags: [Users]
 *     summary: People to show in the contacts sidebar
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: A list of users }
 */
router.get(
  '/contacts',
  asyncHandler(async (req: Request, res: Response) => {
    const me = req.user!.id;
    const users = await prisma.user.findMany({
      where: { id: { not: me }, isActive: true, isBanned: false },
      orderBy: [{ isOnline: 'desc' }, { lastSeenAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        profilePicture: true,
        coverPhoto: true,
        bio: true,
        verified: true,
        isOnline: true,
        lastSeenAt: true,
      },
    });
    const result: PublicUser[] = users.map((u) => ({
      ...u,
      lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
    }));
    sendSuccess(res, { users: result });
  }),
);

/** Update the current user's editable profile fields. */
router.patch(
  '/me',
  validate(updateProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: req.body as UpdateProfileInput });
    sendSuccess(res, { user: toCurrentUser(user) });
  }),
);

/** Upload a new avatar (multipart `image`). */
router.post(
  '/me/avatar',
  uploadSingleImage,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw errors.badRequest('No image uploaded');
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { profilePicture: publicUrl(req.file.filename) } });
    sendSuccess(res, { user: toCurrentUser(user) });
  }),
);

/** Upload a new cover photo (multipart `image`). */
router.post(
  '/me/cover',
  uploadSingleImage,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw errors.badRequest('No image uploaded');
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { coverPhoto: publicUrl(req.file.filename) } });
    sendSuccess(res, { user: toCurrentUser(user) });
  }),
);

/** People the viewer has blocked. */
router.get(
  '/blocked',
  asyncHandler(async (req: Request, res: Response) => {
    const me = req.user!.id;
    const rows = await prisma.block.findMany({
      where: { blockerId: me },
      include: { blocked: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, verified: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, { users: rows.map((r) => r.blocked) });
  }),
);

/** Block a user (also severs any friendship/follow both ways). */
router.post(
  '/:username/block',
  asyncHandler(async (req: Request, res: Response) => {
    const me = req.user!.id;
    const target = await prisma.user.findUnique({ where: { username: req.params.username! }, select: { id: true } });
    if (!target) throw errors.notFound('User not found');
    if (target.id === me) throw errors.badRequest('You cannot block yourself');
    await prisma.$transaction([
      prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: me, blockedId: target.id } },
        create: { blockerId: me, blockedId: target.id },
        update: {},
      }),
      prisma.friendship.deleteMany({
        where: { OR: [{ requesterId: me, addresseeId: target.id }, { requesterId: target.id, addresseeId: me }] },
      }),
      prisma.follow.deleteMany({
        where: { OR: [{ followerId: me, followingId: target.id }, { followerId: target.id, followingId: me }] },
      }),
    ]);
    sendSuccess(res, { blocked: true });
  }),
);

/** Unblock a user. */
router.post(
  '/:username/unblock',
  asyncHandler(async (req: Request, res: Response) => {
    const me = req.user!.id;
    const target = await prisma.user.findUnique({ where: { username: req.params.username! }, select: { id: true } });
    if (!target) throw errors.notFound('User not found');
    await prisma.block.deleteMany({ where: { blockerId: me, blockedId: target.id } });
    sendSuccess(res, { blocked: false });
  }),
);

/**
 * @openapi
 * /users/{username}:
 *   get:
 *     tags: [Users]
 *     summary: Public profile by username (with counts + viewer relation)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Profile }, 404: { description: Not found } }
 */
router.get(
  '/:username',
  asyncHandler(async (req: Request, res: Response) => {
    const me = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { username: req.params.username! },
      select: {
        id: true, firstName: true, lastName: true, username: true,
        profilePicture: true, coverPhoto: true, bio: true,
        location: true, website: true, verified: true, createdAt: true,
        profileVisibility: true,
      },
    });
    if (!user) throw errors.notFound('User not found');

    const [friendCount, followerCount, followingCount, postCount, rel, blockCount] = await Promise.all([
      prisma.friendship.count({ where: { status: 'ACCEPTED', OR: [{ requesterId: user.id }, { addresseeId: user.id }] } }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.post.count({ where: { authorId: user.id, status: 'PUBLISHED', isArchived: false } }),
      friendsService.relationTo(me, user.id),
      prisma.block.count({ where: { blockerId: me, blockedId: user.id } }),
    ]);

    // Profile-visibility gate: a private profile shows only basic info (name,
    // avatar, cover, relation) to non-friends so they can still add/follow.
    const isSelf = user.id === me;
    const isFriend = rel.relation === 'friends';
    const canViewFull =
      isSelf || user.profileVisibility === 'PUBLIC' || (user.profileVisibility === 'FRIENDS' && isFriend);
    const limited = !canViewFull;

    const profile: ProfileDTO = {
      ...user,
      bio: limited ? null : user.bio,
      location: limited ? null : user.location,
      website: limited ? null : user.website,
      createdAt: user.createdAt.toISOString(),
      friendCount, followerCount, followingCount,
      postCount: limited ? 0 : postCount,
      relation: rel.relation,
      requestId: rel.requestId,
      isFollowing: rel.isFollowing,
      isBlocked: blockCount > 0,
      isOwn: isSelf,
      visibility: user.profileVisibility,
      limited,
    };
    sendSuccess(res, { profile });
  }),
);

/**
 * @openapi
 * /users/{username}/posts:
 *   get:
 *     tags: [Users]
 *     summary: A user's posts (privacy-aware)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: A page of posts } }
 */
router.get(
  '/:username/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const me = req.user!.id;
    const user = await prisma.user.findUnique({ where: { username: req.params.username! }, select: { id: true, profileVisibility: true } });
    if (!user) throw errors.notFound('User not found');
    // A private profile hides its posts from non-friends.
    if (user.id !== me && user.profileVisibility !== 'PUBLIC') {
      const isFriend =
        user.profileVisibility === 'FRIENDS' && (await friendsService.relationTo(me, user.id)).relation === 'friends';
      if (!isFriend) {
        sendSuccess(res, { items: [], nextCursor: null, hasMore: false });
        return;
      }
    }
    const cursor = (req.query.cursor as string | undefined) || undefined;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    sendSuccess(res, await postsService.getUserPosts(me, user.id, cursor, limit));
  }),
);

export const usersRouter = router;
