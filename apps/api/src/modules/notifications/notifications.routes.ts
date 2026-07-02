import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { sendSuccess } from '../../utils/response.js';
import { notificationsService } from './notifications.service.js';

const router: Router = Router();
router.use(requireAuth);

const listQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications (paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: A page of notifications } }
 */
router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    sendSuccess(res, await notificationsService.list(req.user!.id, cursor, Number(limit) || 15));
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { unread: await notificationsService.unreadCount(req.user!.id) });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markAllRead(req.user!.id);
    sendSuccess(res, { ok: true });
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markRead(req.params.id!, req.user!.id);
    sendSuccess(res, { ok: true });
  }),
);

export const notificationsRouter = router;
