import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { sendSuccess } from '../../utils/response.js';
import { friendsService } from './friends.service.js';

const router: Router = Router();
router.use(requireAuth);

const userIdBody = z.object({ userId: z.string().min(1) });

/**
 * @openapi
 * tags: [{ name: Friends, description: Friend requests, friendships and follows }]
 */

// Lists
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { friends: await friendsService.listFriends(req.user!.id) });
}));

router.get('/requests', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { requests: await friendsService.listRequests(req.user!.id) });
}));

router.get('/suggestions', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { suggestions: await friendsService.listSuggestions(req.user!.id) });
}));

// Requests
router.post('/requests', validate(userIdBody), asyncHandler(async (req: Request, res: Response) => {
  const result = await friendsService.sendRequest(req.user!.id, (req.body as { userId: string }).userId);
  sendSuccess(res, result, 201);
}));

router.post('/requests/:id/accept', asyncHandler(async (req: Request, res: Response) => {
  const relation = await friendsService.respondToRequest(req.user!.id, req.params.id!, true);
  sendSuccess(res, { relation });
}));

router.post('/requests/:id/reject', asyncHandler(async (req: Request, res: Response) => {
  const relation = await friendsService.respondToRequest(req.user!.id, req.params.id!, false);
  sendSuccess(res, { relation });
}));

router.delete('/requests/:id', asyncHandler(async (req: Request, res: Response) => {
  await friendsService.cancelRequest(req.user!.id, req.params.id!);
  sendSuccess(res, { ok: true });
}));

// Unfriend
router.delete('/:userId', asyncHandler(async (req: Request, res: Response) => {
  await friendsService.unfriend(req.user!.id, req.params.userId!);
  sendSuccess(res, { ok: true });
}));

// Follow / unfollow
router.post('/follow', validate(userIdBody), asyncHandler(async (req: Request, res: Response) => {
  await friendsService.follow(req.user!.id, (req.body as { userId: string }).userId);
  sendSuccess(res, { ok: true });
}));

router.delete('/follow/:userId', asyncHandler(async (req: Request, res: Response) => {
  await friendsService.unfollow(req.user!.id, req.params.userId!);
  sendSuccess(res, { ok: true });
}));

export const friendsRouter = router;
