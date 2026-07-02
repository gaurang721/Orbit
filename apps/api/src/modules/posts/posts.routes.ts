import { Router } from 'express';
import {
  createCommentSchema,
  createPostSchema,
  reactSchema,
  sharePostSchema,
  updateCommentSchema,
  updatePostSchema,
  votePollSchema,
} from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadImages } from '../../middleware/upload.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { postsController } from './posts.controller.js';
import { feedQuerySchema, postIdParamSchema } from './posts.validation.js';

const router: Router = Router();

// All post routes require authentication.
router.use(requireAuth);

/**
 * @openapi
 * /posts:
 *   post:
 *     tags: [Posts]
 *     summary: Create a post
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Created }
 */
router.post('/', uploadImages, validate(createPostSchema), asyncHandler(postsController.create));

/**
 * @openapi
 * /posts/feed:
 *   get:
 *     tags: [Posts]
 *     summary: Personalized news feed (cursor paginated)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: A page of posts }
 */
router.get('/feed', validate(feedQuerySchema, 'query'), asyncHandler(postsController.feed));
router.get('/videos', asyncHandler(postsController.videos));
router.get('/saved', asyncHandler(postsController.listSaved));
router.get('/scheduled', asyncHandler(postsController.listScheduled));

// Hashtag routes must be declared before `/:id` so they aren't swallowed by it.
router.get('/trending-hashtags', asyncHandler(postsController.trendingHashtags));
router.get('/hashtag/:tag', asyncHandler(postsController.hashtagFeed));

// Comment reactions + edit/delete (comment-scoped, before `/:id`).
router.post('/comments/:commentId/react', validate(reactSchema), asyncHandler(postsController.reactComment));
router.delete('/comments/:commentId/react', asyncHandler(postsController.unreactComment));
router.patch('/comments/:commentId', validate(updateCommentSchema), asyncHandler(postsController.updateComment));
router.delete('/comments/:commentId', asyncHandler(postsController.deleteComment));

router.post('/:id/save', validate(postIdParamSchema, 'params'), asyncHandler(postsController.save));
router.post('/:id/unsave', validate(postIdParamSchema, 'params'), asyncHandler(postsController.unsave));

router.get('/:id', validate(postIdParamSchema, 'params'), asyncHandler(postsController.getOne));

/**
 * @openapi
 * /posts/{id}:
 *   patch:
 *     tags: [Posts]
 *     summary: Edit your own post (content and/or privacy)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The updated post }
 *       403: { description: Not the author }
 *       404: { description: Post not found }
 */
router.patch(
  '/:id',
  validate(postIdParamSchema, 'params'),
  validate(updatePostSchema),
  asyncHandler(postsController.update),
);
router.delete('/:id', validate(postIdParamSchema, 'params'), asyncHandler(postsController.remove));

/**
 * @openapi
 * /posts/{id}/react:
 *   post:
 *     tags: [Posts]
 *     summary: Set or toggle a reaction on a post
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated reaction summary }
 */
router.post('/:id/react', validate(postIdParamSchema, 'params'), validate(reactSchema), asyncHandler(postsController.react));
router.delete('/:id/react', validate(postIdParamSchema, 'params'), asyncHandler(postsController.unreact));

/** Share (repost) a post to the viewer's feed. */
router.post('/:id/share', validate(postIdParamSchema, 'params'), validate(sharePostSchema), asyncHandler(postsController.share));

/**
 * @openapi
 * /posts/{id}/vote:
 *   post:
 *     tags: [Posts]
 *     summary: Cast (or change/clear) the viewer's vote on a poll post
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The refreshed poll with updated counts }
 *       400: { description: Poll closed, invalid option, or too many choices }
 *       404: { description: Poll not found }
 */
router.post('/:id/vote', validate(postIdParamSchema, 'params'), validate(votePollSchema), asyncHandler(postsController.votePoll));

router.get('/:id/comments', validate(postIdParamSchema, 'params'), asyncHandler(postsController.listComments));
router.post(
  '/:id/comments',
  validate(postIdParamSchema, 'params'),
  validate(createCommentSchema),
  asyncHandler(postsController.addComment),
);

export const postsRouter = router;
