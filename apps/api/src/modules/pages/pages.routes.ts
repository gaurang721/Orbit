import { Router } from 'express';
import type { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { createPageSchema, createPostSchema, updatePageSchema, type CreatePostInput, type PageDTO, type PageType, type UpdatePageInput } from '@fbclone/types';
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

type PageRow = { id: string; name: string; slug: string; type: PageType; category: string | null; about: string | null; avatar: string | null; coverPhoto: string | null; followerCount: number; ownerId: string; createdAt: Date };

function toDTO(p: PageRow, isFollowing: boolean, meId: string): PageDTO {
  return {
    id: p.id, name: p.name, slug: p.slug, type: p.type, category: p.category, about: p.about,
    avatar: p.avatar, coverPhoto: p.coverPhoto, followerCount: p.followerCount,
    isFollowing, isOwner: p.ownerId === meId, createdAt: p.createdAt.toISOString(),
  };
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const pages = await prisma.page.findMany({ orderBy: { followerCount: 'desc' }, take: 50 });
  const follows = await prisma.pageFollow.findMany({ where: { userId: me, pageId: { in: pages.map((p) => p.id) } } });
  const following = new Set(follows.map((f) => f.pageId));
  sendSuccess(res, { pages: pages.map((p) => toDTO(p, following.has(p.id), me)) });
}));

router.post('/', validate(createPageSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const { name, category, about, type } = req.body as { name: string; category?: string; about?: string; type: PageType };
  const page = await prisma.page.create({ data: { name, slug: slugify(name, nanoid(6)), category, about, type, ownerId: me } });
  sendSuccess(res, { page: toDTO(page, false, me) }, 201);
}));

router.get('/:slug', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const page = await prisma.page.findUnique({ where: { slug: req.params.slug! } });
  if (!page) throw errors.notFound('Page not found');
  const isFollowing = (await prisma.pageFollow.count({ where: { pageId: page.id, userId: me } })) > 0;
  sendSuccess(res, { page: toDTO(page, isFollowing, me) });
}));

// ----- Page posts (in-context feed) -----------------------------------------
// Anyone can read a page's posts; only the page owner can publish as the page.
router.get('/:id/posts', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const page = await postsService.getPagePosts(me, req.params.id!, cursor, Number(limit) || 10);
  sendSuccess(res, page);
}));

router.post('/:id/posts', uploadImages, validate(createPostSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const pageId = req.params.id!;
  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page) throw errors.notFound('Page not found');
  if (page.ownerId !== me) throw errors.forbidden('Only the page owner can post as this page');
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const post = await postsService.create(me, req.body as CreatePostInput, files, { pageId });
  sendSuccess(res, { post }, 201);
}));

/** Edit page details (owner only). */
router.patch('/:id', validate(updatePageSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const existing = await prisma.page.findUnique({ where: { id: req.params.id! }, select: { ownerId: true } });
  if (!existing) throw errors.notFound('Page not found');
  if (existing.ownerId !== me) throw errors.forbidden('Only the page owner can edit it');
  const b = req.body as UpdatePageInput;
  const page = await prisma.page.update({
    where: { id: req.params.id! },
    data: {
      ...(b.name !== undefined ? { name: b.name } : {}),
      ...(b.category !== undefined ? { category: b.category } : {}),
      ...(b.about !== undefined ? { about: b.about } : {}),
      ...(b.type !== undefined ? { type: b.type } : {}),
    },
  });
  const isFollowing = (await prisma.pageFollow.count({ where: { pageId: page.id, userId: me } })) > 0;
  sendSuccess(res, { page: toDTO(page, isFollowing, me) });
}));

/** Delete a page and its posts/followers (owner only). */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const existing = await prisma.page.findUnique({ where: { id: req.params.id! }, select: { ownerId: true } });
  if (!existing) throw errors.notFound('Page not found');
  if (existing.ownerId !== me) throw errors.forbidden('Only the page owner can delete it');
  await prisma.page.delete({ where: { id: req.params.id! } });
  sendSuccess(res, { ok: true });
}));

router.post('/:id/follow', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const existing = await prisma.pageFollow.findUnique({ where: { pageId_userId: { pageId: req.params.id!, userId: me } } });
  if (!existing) {
    await prisma.$transaction([
      prisma.pageFollow.create({ data: { pageId: req.params.id!, userId: me } }),
      prisma.page.update({ where: { id: req.params.id! }, data: { followerCount: { increment: 1 } } }),
    ]);
  }
  sendSuccess(res, { ok: true });
}));

router.post('/:id/unfollow', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const deleted = await prisma.pageFollow.deleteMany({ where: { pageId: req.params.id!, userId: me } });
  if (deleted.count > 0) await prisma.page.update({ where: { id: req.params.id! }, data: { followerCount: { decrement: 1 } } });
  sendSuccess(res, { ok: true });
}));

export const pagesRouter = router;
