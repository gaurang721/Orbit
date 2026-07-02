import { Router } from 'express';
import { sendSuccess } from '../utils/response.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { postsRouter } from '../modules/posts/posts.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { friendsRouter } from '../modules/friends/friends.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { chatRouter } from '../modules/chat/chat.routes.js';
import { storiesRouter } from '../modules/stories/stories.routes.js';
import { groupsRouter } from '../modules/groups/groups.routes.js';
import { pagesRouter } from '../modules/pages/pages.routes.js';
import { marketRouter } from '../modules/market/market.routes.js';
import { eventsRouter } from '../modules/events/events.routes.js';
import { searchRouter } from '../modules/search/search.routes.js';
import { adminRouter, reportsRouter } from '../modules/admin/admin.routes.js';

const router: Router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Liveness probe
 *     responses:
 *       200: { description: API is up }
 */
router.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Feature modules mount here. Future phases add: users, posts, feed, comments,
// reactions, messenger, notifications, stories, groups, pages, marketplace,
// events, search, admin.
router.use('/auth', authRouter);
router.use('/posts', postsRouter);
router.use('/users', usersRouter);
router.use('/friends', friendsRouter);
router.use('/notifications', notificationsRouter);
router.use('/chat', chatRouter);
router.use('/stories', storiesRouter);
router.use('/groups', groupsRouter);
router.use('/pages', pagesRouter);
router.use('/market', marketRouter);
router.use('/events', eventsRouter);
router.use('/search', searchRouter);
router.use('/reports', reportsRouter);
router.use('/admin', adminRouter);

export const apiRouter = router;
