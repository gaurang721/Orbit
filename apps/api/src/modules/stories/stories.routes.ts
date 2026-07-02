import { Router } from 'express';
import type { Request, Response } from 'express';
import { createStorySchema, reactStorySchema } from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadSingleImage } from '../../middleware/upload.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { sendSuccess } from '../../utils/response.js';
import { storiesService } from './stories.service.js';

const router: Router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /stories:
 *   get:
 *     tags: [Stories]
 *     summary: Active stories grouped by author (self + friends)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Story groups } }
 *   post:
 *     tags: [Stories]
 *     summary: Create a story (image upload or text)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { groups: await storiesService.getFeed(req.user!.id) });
}));

router.post(
  '/',
  uploadSingleImage,
  validate(createStorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    const story = await storiesService.create(req.user!.id, req.body, file);
    sendSuccess(res, { story }, 201);
  }),
);

router.post('/:id/view', asyncHandler(async (req: Request, res: Response) => {
  await storiesService.view(req.user!.id, req.params.id!);
  sendSuccess(res, { ok: true });
}));

router.get('/:id/viewers', asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { viewers: await storiesService.viewers(req.user!.id, req.params.id!) });
}));

router.post(
  '/:id/react',
  validate(reactStorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await storiesService.react(req.user!.id, req.params.id!, (req.body as { emoji: string }).emoji);
    sendSuccess(res, { ok: true });
  }),
);

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await storiesService.remove(req.user!.id, req.params.id!);
  sendSuccess(res, { ok: true });
}));

export const storiesRouter = router;
