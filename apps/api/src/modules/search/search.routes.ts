import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SearchResults } from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { userRefSelect } from '../../lib/selects.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { sendSuccess } from '../../utils/response.js';

const router: Router = Router();
router.use(requireAuth);

const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Global search across people, posts, groups, pages and marketplace
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Grouped results } }
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 1) {
      sendSuccess(res, { users: [], groups: [], pages: [], products: [], posts: [] } satisfies SearchResults);
      return;
    }

    const [users, groups, pages, products, posts] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ firstName: contains(q) }, { lastName: contains(q) }, { username: contains(q) }] },
        select: userRefSelect,
        take: 12,
      }),
      prisma.group.findMany({
        where: { privacy: { not: 'SECRET' }, name: contains(q) },
        select: { id: true, name: true, slug: true, memberCount: true },
        take: 8,
      }),
      prisma.page.findMany({
        where: { name: contains(q) },
        select: { id: true, name: true, slug: true, followerCount: true },
        take: 8,
      }),
      prisma.product.findMany({
        where: { status: 'AVAILABLE', title: contains(q) },
        select: { id: true, title: true, price: true, currency: true, images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } } },
        take: 8,
      }),
      prisma.post.findMany({
        where: { status: 'PUBLISHED', isArchived: false, privacy: 'PUBLIC', content: contains(q) },
        include: { author: { select: userRefSelect } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const results: SearchResults = {
      users,
      groups,
      pages,
      products: products.map((p) => ({ id: p.id, title: p.title, price: Number(p.price), currency: p.currency, image: p.images[0]?.url ?? null })),
      posts: posts.map((p) => ({ id: p.id, content: p.content, author: p.author, createdAt: p.createdAt.toISOString() })),
    };
    sendSuccess(res, results);
  }),
);

export const searchRouter = router;
