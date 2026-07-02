import type { Request, Response } from 'express';
import type {
  CreateCommentInput,
  CreatePostInput,
  ReactInput,
  SharePostInput,
  UpdateCommentInput,
  UpdatePostInput,
  VotePollInput,
} from '@fbclone/types';
import { sendSuccess } from '../../utils/response.js';
import { postsService } from './posts.service.js';

export const postsController = {
  async create(req: Request, res: Response): Promise<void> {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const post = await postsService.create(req.user!.id, req.body as CreatePostInput, files);
    sendSuccess(res, { post }, 201);
  },

  async feed(req: Request, res: Response): Promise<void> {
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    const page = await postsService.getFeed(req.user!.id, cursor, Number(limit) || 10);
    sendSuccess(res, page);
  },

  async videos(req: Request, res: Response): Promise<void> {
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit?: number };
    const page = await postsService.getVideos(req.user!.id, cursor, Number(limit) || 10);
    sendSuccess(res, page);
  },

  async listSaved(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { posts: await postsService.listSaved(req.user!.id) });
  },

  async listScheduled(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { posts: await postsService.getScheduled(req.user!.id) });
  },

  async hashtagFeed(req: Request, res: Response): Promise<void> {
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit?: number };
    const page = await postsService.getHashtagFeed(req.user!.id, req.params.tag!, cursor, Number(limit) || 10);
    sendSuccess(res, page);
  },

  async trendingHashtags(req: Request, res: Response): Promise<void> {
    const limit = Math.min(Number((req.query as { limit?: string }).limit) || 8, 20);
    sendSuccess(res, { hashtags: await postsService.trendingHashtags(limit) });
  },

  async save(req: Request, res: Response): Promise<void> {
    await postsService.savePost(req.user!.id, req.params.id!, true);
    sendSuccess(res, { saved: true });
  },

  async unsave(req: Request, res: Response): Promise<void> {
    await postsService.savePost(req.user!.id, req.params.id!, false);
    sendSuccess(res, { saved: false });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const post = await postsService.getOne(req.user!.id, req.params.id!);
    sendSuccess(res, { post });
  },

  async update(req: Request, res: Response): Promise<void> {
    const post = await postsService.update(req.user!.id, req.params.id!, req.body as UpdatePostInput);
    sendSuccess(res, { post });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await postsService.remove(req.user!.id, req.params.id!);
    sendSuccess(res, { ok: true }, 200, 'Post deleted');
  },

  async share(req: Request, res: Response): Promise<void> {
    const post = await postsService.share(req.user!.id, req.params.id!, req.body as SharePostInput);
    sendSuccess(res, { post }, 201);
  },

  async react(req: Request, res: Response): Promise<void> {
    const reactions = await postsService.react(req.user!.id, req.params.id!, req.body as ReactInput);
    sendSuccess(res, { reactions });
  },

  async unreact(req: Request, res: Response): Promise<void> {
    const reactions = await postsService.unreact(req.user!.id, req.params.id!);
    sendSuccess(res, { reactions });
  },

  async votePoll(req: Request, res: Response): Promise<void> {
    const poll = await postsService.votePoll(
      req.user!.id,
      req.params.id!,
      (req.body as VotePollInput).optionIds,
    );
    sendSuccess(res, { poll });
  },

  async listComments(req: Request, res: Response): Promise<void> {
    const comments = await postsService.listComments(req.user!.id, req.params.id!);
    sendSuccess(res, { comments });
  },

  async addComment(req: Request, res: Response): Promise<void> {
    const comment = await postsService.addComment(
      req.user!.id,
      req.params.id!,
      req.body as CreateCommentInput,
    );
    sendSuccess(res, { comment }, 201);
  },

  async reactComment(req: Request, res: Response): Promise<void> {
    const result = await postsService.reactToComment(req.user!.id, req.params.commentId!, req.body as ReactInput);
    sendSuccess(res, result);
  },

  async unreactComment(req: Request, res: Response): Promise<void> {
    const result = await postsService.unreactComment(req.user!.id, req.params.commentId!);
    sendSuccess(res, result);
  },

  async updateComment(req: Request, res: Response): Promise<void> {
    const comment = await postsService.updateComment(
      req.user!.id,
      req.params.commentId!,
      (req.body as UpdateCommentInput).content,
    );
    sendSuccess(res, { comment });
  },

  async deleteComment(req: Request, res: Response): Promise<void> {
    await postsService.deleteComment(req.user!.id, req.params.commentId!);
    sendSuccess(res, { ok: true }, 200, 'Comment deleted');
  },
};
