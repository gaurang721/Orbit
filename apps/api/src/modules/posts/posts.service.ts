import type { Prisma } from '@prisma/client';
import type {
  CommentDTO,
  CreateCommentInput,
  CreatePostInput,
  MediaType,
  Paginated,
  PollDTO,
  PostDTO,
  ReactionSummary,
  ReactionType,
  ReactInput,
  SharedPostDTO,
  SharePostInput,
  UpdatePostInput,
} from '@fbclone/types';
import { errors } from '../../utils/http-error.js';
import { publicUrl } from '../../lib/storage.js';
import { extractHashtags, extractMentions } from '../../lib/text-parse.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { postsRepository } from './posts.repository.js';

/** A multer file we care about (subset of Express.Multer.File). */
export interface UploadedFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

type PostWithAuthor = Awaited<ReturnType<typeof postsRepository.findPost>>;
type PollWithOptions = NonNullable<NonNullable<PostWithAuthor>['poll']>;
type CommentWithAuthor = Awaited<ReturnType<typeof postsRepository.createComment>>;

/** Build a PollDTO, marking options the viewer voted for via `votedOptionIds`. */
function mapPoll(poll: PollWithOptions, votedOptionIds: Set<string>): PollDTO {
  const options = poll.options.map((o) => ({
    id: o.id,
    text: o.text,
    voteCount: o.voteCount,
    votedByMe: votedOptionIds.has(o.id),
  }));
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    expiresAt: poll.expiresAt ? poll.expiresAt.toISOString() : null,
    closed: poll.expiresAt ? poll.expiresAt.getTime() < Date.now() : false,
    totalVotes: options.reduce((sum, o) => sum + o.voteCount, 0),
    options,
  };
}

type SharedPostRow = NonNullable<NonNullable<PostWithAuthor>['sharedPost']>;

/** Map the embedded original of a SHARE post to a slim DTO. */
function mapShared(sp: SharedPostRow): SharedPostDTO {
  return {
    id: sp.id,
    author: sp.author,
    content: sp.content,
    type: sp.type,
    backgroundColor: sp.backgroundColor,
    media: sp.media.map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      width: m.width,
      height: m.height,
      mimeType: m.mimeType,
      size: m.size,
      fileName: m.altText,
    })),
    createdAt: sp.createdAt.toISOString(),
  };
}

function mapPost(
  post: NonNullable<PostWithAuthor>,
  reactions: ReactionSummary,
  viewerId: string,
  votedOptionIds: Set<string> = new Set(),
): PostDTO {
  return {
    id: post.id,
    author: post.author,
    content: post.content,
    type: post.type,
    privacy: post.privacy,
    backgroundColor: post.backgroundColor,
    feeling: post.feeling,
    media: post.media.map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      width: m.width,
      height: m.height,
      mimeType: m.mimeType,
      size: m.size,
      // FILE attachments carry their original filename in altText.
      fileName: m.altText,
    })),
    poll: post.poll ? mapPoll(post.poll, votedOptionIds) : null,
    sharedPost: post.sharedPost ? mapShared(post.sharedPost) : null,
    taggedUsers: post.tags.map((t) => t.user),
    scheduledFor: post.scheduledFor ? post.scheduledFor.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt ? post.editedAt.toISOString() : null,
    reactions,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    isOwn: post.authorId === viewerId,
  };
}

function mediaTypeFor(mimetype: string): MediaType {
  if (mimetype.startsWith('video/')) return 'VIDEO';
  if (mimetype === 'image/gif') return 'GIF';
  if (mimetype.startsWith('image/')) return 'IMAGE';
  // Anything else that passed upload validation is a document attachment.
  return 'FILE';
}

function mapComment(
  comment: NonNullable<CommentWithAuthor>,
  viewerId: string,
  myReaction: ReactionType | null = null,
): CommentDTO {
  return {
    id: comment.id,
    postId: comment.postId,
    author: comment.author,
    content: comment.content,
    parentId: comment.parentId,
    createdAt: comment.createdAt.toISOString(),
    editedAt: comment.editedAt ? comment.editedAt.toISOString() : null,
    reactionCount: comment.reactionCount,
    myReaction,
    isOwn: comment.authorId === viewerId,
  };
}

const emptySummary = (): ReactionSummary => ({ counts: {}, total: 0, mine: null });

export const postsService = {
  async create(
    authorId: string,
    input: CreatePostInput,
    files: UploadedFile[] = [],
    opts: { pageId?: string; groupId?: string } = {},
  ): Promise<PostDTO> {
    const content = input.content.trim();
    if (!content && files.length === 0 && !input.poll) {
      throw errors.badRequest('Write something, add a photo, or create a poll');
    }

    const hasVideo = files.some((f) => f.mimetype.startsWith('video/'));
    const type = files.length > 0
      ? hasVideo
        ? 'VIDEO'
        : 'IMAGE'
      : input.poll
        ? 'POLL'
        : input.backgroundColor
          ? 'BACKGROUND'
          : 'TEXT';
    const mediaCreate: Prisma.MediaCreateWithoutPostInput[] = files.map((f, i) => {
      const mediaType = mediaTypeFor(f.mimetype);
      return {
        uploader: { connect: { id: authorId } },
        type: mediaType,
        url: publicUrl(f.filename),
        mimeType: f.mimetype,
        size: f.size,
        position: i,
        // Keep the original filename for FILE attachments (shown on the card).
        ...(mediaType === 'FILE' ? { altText: f.originalname } : {}),
      };
    });

    const pollCreate: Prisma.PollCreateNestedOneWithoutPostInput | undefined = input.poll
      ? {
          create: {
            question: input.poll.question.trim(),
            allowMultiple: input.poll.allowMultiple ?? false,
            expiresAt: input.poll.durationDays
              ? new Date(Date.now() + input.poll.durationDays * 86_400_000)
              : null,
            options: {
              create: input.poll.options.map((text, i) => ({ text: text.trim(), position: i })),
            },
          },
        }
      : undefined;

    // Scheduling: a future time (>30s out) parks the post as SCHEDULED.
    let status: Prisma.PostCreateInput['status'] = 'PUBLISHED';
    let publishedAt: Date | null = new Date();
    let scheduledFor: Date | null = null;
    if (input.scheduledFor) {
      const d = new Date(input.scheduledFor);
      if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now() + 30_000) {
        status = 'SCHEDULED';
        publishedAt = null;
        scheduledFor = d;
      }
    }

    const post = await postsRepository.createPost({
      author: { connect: { id: authorId } },
      type,
      status,
      publishedAt,
      scheduledFor,
      content,
      privacy: input.privacy,
      backgroundColor: input.backgroundColor,
      feeling: input.feeling,
      ...(opts.pageId ? { page: { connect: { id: opts.pageId } } } : {}),
      ...(opts.groupId ? { group: { connect: { id: opts.groupId } } } : {}),
      ...(mediaCreate.length ? { media: { create: mediaCreate } } : {}),
      ...(pollCreate ? { poll: pollCreate } : {}),
    });
    if (content) await this.processTagsAndMentions(post.id, authorId, content);
    await this.processTaggedUsers(post.id, authorId, input.taggedUserIds);
    // Re-fetch so the response reflects any tags just attached.
    const fresh = await postsRepository.findPost(post.id);
    return mapPost(fresh ?? post, emptySummary(), authorId);
  },

  /** Tag people in a post ("with …"): create PostTag rows + notify each.
   *  Accepts an array (JSON body) or a CSV string (multipart body). */
  async processTaggedUsers(postId: string, authorId: string, raw: string[] | string | undefined): Promise<void> {
    const list = Array.isArray(raw) ? raw : raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const ids = [...new Set(list)].filter((id) => id !== authorId);
    if (ids.length === 0) return;
    const valid = await postsRepository.existingUserIds(ids);
    if (valid.length === 0) return;
    await postsRepository.createPostTags(postId, valid);
    for (const uid of valid) {
      await notificationsService.notify({
        recipientId: uid,
        actorId: authorId,
        type: 'TAG',
        message: 'tagged you in a post',
        link: `/post/${postId}`,
        entityType: 'Post',
        entityId: postId,
      });
    }
  },

  /** The viewer's own scheduled (not-yet-published) posts. */
  async getScheduled(viewerId: string): Promise<PostDTO[]> {
    const posts = await postsRepository.scheduledPosts(viewerId);
    return this.toDTOs(viewerId, posts);
  },

  /**
   * Share (repost) an existing post to the viewer's feed with an optional caption.
   * Shares always point at the ROOT original (sharing a share re-shares the
   * original, never nesting), bump the original's shareCount, and notify its author.
   */
  async share(viewerId: string, originalPostId: string, input: SharePostInput): Promise<PostDTO> {
    const original = await postsRepository.findPost(originalPostId);
    if (!original) throw errors.notFound('Post not found');

    // If the target is itself a share, point at the root original instead.
    const targetId = original.sharedPost?.id ?? original.id;
    const targetAuthorId = original.sharedPost?.author.id ?? original.authorId;

    const caption = input.content.trim();
    const share = await postsRepository.createPost({
      author: { connect: { id: viewerId } },
      type: 'SHARE',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      content: caption,
      privacy: input.privacy,
      sharedPost: { connect: { id: targetId } },
    });
    await postsRepository.incrementShareCount(targetId);
    if (caption) await this.processTagsAndMentions(share.id, viewerId, caption);

    if (targetAuthorId !== viewerId) {
      await notificationsService.notify({
        recipientId: targetAuthorId,
        actorId: viewerId,
        type: 'SHARE',
        message: 'shared your post',
        link: `/post/${share.id}`,
        entityType: 'Post',
        entityId: share.id,
      });
    }
    return (await this.toDTOs(viewerId, [share]))[0]!;
  },

  /** Parse #hashtags and @mentions from new post content: index tags, notify mentioned users. */
  async processTagsAndMentions(postId: string, authorId: string, content: string): Promise<void> {
    const tags = extractHashtags(content);
    if (tags.length) await postsRepository.syncHashtags(postId, tags);

    const handles = extractMentions(content);
    if (handles.length === 0) return;
    const users = (await postsRepository.usersByUsernames(handles)).filter((u) => u.id !== authorId);
    if (users.length === 0) return;
    await postsRepository.createMentions(postId, users.map((u) => u.id));
    for (const u of users) {
      await notificationsService.notify({
        recipientId: u.id,
        actorId: authorId,
        type: 'MENTION',
        message: 'mentioned you in a post',
        link: `/post/${postId}`,
        entityType: 'Post',
        entityId: postId,
      });
    }
  },

  /** Posts published to a specific Page, newest first (cursor paginated). */
  async getPagePosts(
    viewerId: string,
    pageId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Paginated<PostDTO>> {
    const where: Prisma.PostWhereInput = { pageId, status: 'PUBLISHED', isArchived: false };
    const rows = await postsRepository.feed(where, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: await this.toDTOs(viewerId, page),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  /** Posts published inside a specific Group, newest first (cursor paginated). */
  async getGroupPosts(
    viewerId: string,
    groupId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Paginated<PostDTO>> {
    const where: Prisma.PostWhereInput = { groupId, status: 'PUBLISHED', isArchived: false };
    const rows = await postsRepository.feed(where, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: await this.toDTOs(viewerId, page),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  async getFeed(viewerId: string, cursor: string | undefined, limit: number): Promise<Paginated<PostDTO>> {
    const [friends, blocked, groupIds, pageIds] = await Promise.all([
      postsRepository.friendIds(viewerId),
      postsRepository.blockedUserIds(viewerId),
      postsRepository.memberGroupIds(viewerId),
      postsRepository.feedPageIds(viewerId),
    ]);

    // The feed pulls from three sources: your personal timeline (public/own/
    // friends posts not tied to a group or page), posts from groups you're in,
    // and posts from pages you follow or own. Blocked authors are excluded
    // across all of them.
    const sources: Prisma.PostWhereInput[] = [
      {
        groupId: null,
        pageId: null,
        OR: [
          { privacy: 'PUBLIC' },
          { authorId: viewerId },
          { privacy: 'FRIENDS', authorId: { in: friends } },
        ],
      },
    ];
    if (groupIds.length) sources.push({ groupId: { in: groupIds } });
    if (pageIds.length) sources.push({ pageId: { in: pageIds } });

    const where: Prisma.PostWhereInput = {
      status: 'PUBLISHED',
      isArchived: false,
      ...(blocked.length ? { authorId: { notIn: blocked } } : {}),
      OR: sources,
    };

    const rows = await postsRepository.feed(where, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: await this.toDTOs(viewerId, page),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  /** Posts authored by a specific user, respecting privacy for the viewer. */
  async getUserPosts(
    viewerId: string,
    authorId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Paginated<PostDTO>> {
    const isSelf = viewerId === authorId;
    const friends = isSelf ? [] : await postsRepository.friendIds(viewerId);
    const areFriends = friends.includes(authorId);
    const where: Prisma.PostWhereInput = {
      authorId,
      status: 'PUBLISHED',
      isArchived: false,
      groupId: null,
      pageId: null,
      ...(isSelf
        ? {}
        : { privacy: { in: areFriends ? ['PUBLIC', 'FRIENDS'] : ['PUBLIC'] } }),
    };
    const rows = await postsRepository.feed(where, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: await this.toDTOs(viewerId, page),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  /** Watch feed: posts that contain a video attachment. */
  async getVideos(viewerId: string, cursor: string | undefined, limit: number): Promise<Paginated<PostDTO>> {
    const friends = await postsRepository.friendIds(viewerId);
    const where: Prisma.PostWhereInput = {
      status: 'PUBLISHED',
      isArchived: false,
      media: { some: { type: 'VIDEO' } },
      OR: [{ privacy: 'PUBLIC' }, { authorId: viewerId }, { privacy: 'FRIENDS', authorId: { in: friends } }],
    };
    const rows = await postsRepository.feed(where, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: await this.toDTOs(viewerId, page),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  /** Feed of posts carrying a given #hashtag (privacy-respecting). */
  async getHashtagFeed(
    viewerId: string,
    tag: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Paginated<PostDTO>> {
    const friends = await postsRepository.friendIds(viewerId);
    const where: Prisma.PostWhereInput = {
      status: 'PUBLISHED',
      isArchived: false,
      groupId: null,
      pageId: null,
      hashtags: { some: { hashtag: { tag: tag.toLowerCase() } } },
      OR: [{ privacy: 'PUBLIC' }, { authorId: viewerId }, { privacy: 'FRIENDS', authorId: { in: friends } }],
    };
    const rows = await postsRepository.feed(where, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: await this.toDTOs(viewerId, page),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  async trendingHashtags(limit: number): Promise<Array<{ tag: string; postCount: number }>> {
    return postsRepository.trendingHashtags(limit);
  },

  async savePost(viewerId: string, postId: string, save: boolean): Promise<void> {
    if (save) await postsRepository.savePost(viewerId, postId);
    else await postsRepository.unsavePost(viewerId, postId);
  },

  async listSaved(viewerId: string): Promise<PostDTO[]> {
    const posts = await postsRepository.listSavedPosts(viewerId);
    return this.toDTOs(viewerId, posts);
  },

  /** The set of poll-option ids (across these posts) the viewer has voted for. */
  async pollVoteSet(viewerId: string, posts: NonNullable<PostWithAuthor>[]): Promise<Set<string>> {
    const optionIds = posts.flatMap((p) => p.poll?.options.map((o) => o.id) ?? []);
    if (optionIds.length === 0) return new Set();
    return new Set(await postsRepository.votedOptionIds(viewerId, optionIds));
  },

  /** Map a batch of posts to DTOs, resolving reactions and poll votes together. */
  async toDTOs(viewerId: string, posts: NonNullable<PostWithAuthor>[]): Promise<PostDTO[]> {
    if (posts.length === 0) return [];
    const [summaries, votedSet] = await Promise.all([
      this.buildSummaries(viewerId, posts.map((p) => p.id)),
      this.pollVoteSet(viewerId, posts),
    ]);
    return posts.map((p) => mapPost(p, summaries[p.id] ?? emptySummary(), viewerId, votedSet));
  },

  /** Build per-post reaction summaries (counts + viewer's own) in two queries. */
  async buildSummaries(viewerId: string, postIds: string[]): Promise<Record<string, ReactionSummary>> {
    const result: Record<string, ReactionSummary> = {};
    if (postIds.length === 0) return result;
    for (const id of postIds) result[id] = emptySummary();

    const [grouped, mine] = await Promise.all([
      postsRepository.reactionCounts(postIds),
      postsRepository.myReactions(viewerId, postIds),
    ]);

    for (const g of grouped) {
      if (!g.postId) continue;
      const s = (result[g.postId] ??= emptySummary());
      const count = g._count._all;
      s.counts[g.type as ReactionType] = count;
      s.total += count;
    }
    for (const m of mine) {
      if (m.postId && result[m.postId]) result[m.postId]!.mine = m.type as ReactionType;
    }
    return result;
  },

  /**
   * Throw notFound unless the viewer may see this post. Enforces post privacy
   * (PUBLIC / FRIENDS / ONLY_ME), block relationships, group membership, and
   * published/non-archived status. The author can always see their own post.
   * notFound (not forbidden) is used so a hidden post's existence isn't leaked.
   */
  async assertCanViewPost(
    viewerId: string,
    post: { authorId: string; privacy: string; status: string; isArchived: boolean; groupId: string | null; pageId: string | null },
  ): Promise<void> {
    if (post.authorId === viewerId) return;
    if (post.status !== 'PUBLISHED' || post.isArchived) throw errors.notFound('Post not found');
    const blocked = await postsRepository.blockedUserIds(viewerId);
    if (blocked.includes(post.authorId)) throw errors.notFound('Post not found');
    if (post.groupId) {
      if (!(await postsRepository.isGroupMember(viewerId, post.groupId))) throw errors.notFound('Post not found');
      return;
    }
    if (post.pageId || post.privacy === 'PUBLIC') return;
    if (post.privacy === 'FRIENDS') {
      const friends = await postsRepository.friendIds(viewerId);
      if (!friends.includes(post.authorId)) throw errors.notFound('Post not found');
      return;
    }
    // ONLY_ME (and CUSTOM without a shared list) — not visible to others.
    throw errors.notFound('Post not found');
  },

  async getOne(viewerId: string, postId: string): Promise<PostDTO> {
    const post = await postsRepository.findPost(postId);
    if (!post) throw errors.notFound('Post not found');
    await this.assertCanViewPost(viewerId, post);
    return (await this.toDTOs(viewerId, [post]))[0]!;
  },

  async update(viewerId: string, postId: string, input: UpdatePostInput): Promise<PostDTO> {
    const post = await postsRepository.findPost(postId);
    if (!post) throw errors.notFound('Post not found');
    if (post.authorId !== viewerId) throw errors.forbidden('You can only edit your own posts');

    const data: Prisma.PostUpdateInput = { editedAt: new Date() };
    if (input.content !== undefined) {
      const content = input.content.trim();
      // A post must still have something to show after the edit.
      if (!content && post.media.length === 0 && !post.backgroundColor) {
        throw errors.badRequest('Post cannot be empty');
      }
      data.content = content;
    }
    if (input.privacy !== undefined) data.privacy = input.privacy;

    const updated = await postsRepository.updatePost(postId, data);
    return (await this.toDTOs(viewerId, [updated]))[0]!;
  },

  async remove(viewerId: string, postId: string): Promise<void> {
    const post = await postsRepository.findPost(postId);
    if (!post) throw errors.notFound('Post not found');
    if (post.authorId !== viewerId) throw errors.forbidden('You can only delete your own posts');
    await postsRepository.deletePost(postId);
  },

  async react(viewerId: string, postId: string, input: ReactInput): Promise<ReactionSummary> {
    const post = await postsRepository.findPost(postId);
    if (!post) throw errors.notFound('Post not found');
    await this.assertCanViewPost(viewerId, post);

    const existing = await postsRepository.findReaction(viewerId, postId);
    if (existing && existing.type === input.type) {
      // clicking the same reaction toggles it off
      await postsRepository.removeReaction(viewerId, postId);
    } else {
      await postsRepository.setReaction(viewerId, postId, input.type);
      // notify the author when someone newly reacts (not on toggle-off)
      await notificationsService.notify({
        recipientId: post.authorId,
        actorId: viewerId,
        type: 'REACTION',
        message: `reacted ${input.type.toLowerCase()} to your post`,
        link: `/post/${postId}`,
        entityType: 'Post',
        entityId: postId,
      });
    }
    return (await this.buildSummaries(viewerId, [postId]))[postId] ?? emptySummary();
  },

  async unreact(viewerId: string, postId: string): Promise<ReactionSummary> {
    await postsRepository.removeReaction(viewerId, postId);
    return (await this.buildSummaries(viewerId, [postId]))[postId] ?? emptySummary();
  },

  // ----- Polls ---------------------------------------------------------------
  /**
   * Set the viewer's selection on a poll to exactly `optionIds` (empty = clear).
   * Single-choice polls reject more than one id; closed polls reject any vote.
   * Returns the refreshed poll so the caller sees up-to-date counts + percentages.
   */
  async votePoll(viewerId: string, postId: string, optionIds: string[]): Promise<PollDTO> {
    const poll = await postsRepository.findPollByPostId(postId);
    if (!poll) throw errors.notFound('Poll not found');
    if (poll.expiresAt && poll.expiresAt.getTime() < Date.now()) {
      throw errors.badRequest('This poll has closed');
    }

    const validIds = poll.options.map((o) => o.id);
    const validSet = new Set(validIds);
    const desired = [...new Set(optionIds)];
    if (desired.some((id) => !validSet.has(id))) {
      throw errors.badRequest('Invalid poll option');
    }
    if (!poll.allowMultiple && desired.length > 1) {
      throw errors.badRequest('This poll allows only one choice');
    }

    await postsRepository.setVotes(viewerId, validIds, desired);
    const fresh = await postsRepository.findPollByPostId(postId);
    return mapPoll(fresh!, new Set(desired));
  },

  // ----- Comments ------------------------------------------------------------
  async listComments(viewerId: string, postId: string): Promise<CommentDTO[]> {
    const post = await postsRepository.findPost(postId);
    if (!post) throw errors.notFound('Post not found');
    await this.assertCanViewPost(viewerId, post);
    const comments = await postsRepository.listComments(postId);
    const mine = await postsRepository.myCommentReactions(viewerId, comments.map((c) => c.id));
    const byId = new Map(mine.map((m) => [m.commentId, m.type]));
    return comments.map((c) => mapComment(c, viewerId, byId.get(c.id) ?? null));
  },

  async reactToComment(
    viewerId: string,
    commentId: string,
    input: ReactInput,
  ): Promise<{ reactionCount: number; myReaction: ReactionType | null }> {
    const comment = await postsRepository.getCommentById(commentId);
    if (!comment) throw errors.notFound('Comment not found');
    const existing = await postsRepository.findCommentReaction(viewerId, commentId);
    if (existing && existing.type === input.type) {
      const reactionCount = await postsRepository.removeCommentReaction(viewerId, commentId);
      return { reactionCount, myReaction: null };
    }
    const reactionCount = await postsRepository.setCommentReaction(viewerId, commentId, input.type);
    if (comment.authorId !== viewerId) {
      await notificationsService.notify({
        recipientId: comment.authorId,
        actorId: viewerId,
        type: 'COMMENT_REACTION',
        message: `reacted ${input.type.toLowerCase()} to your comment`,
        link: `/post/${comment.postId}`,
        entityType: 'Comment',
        entityId: commentId,
      });
    }
    return { reactionCount, myReaction: input.type };
  },

  async unreactComment(viewerId: string, commentId: string): Promise<{ reactionCount: number; myReaction: null }> {
    const reactionCount = await postsRepository.removeCommentReaction(viewerId, commentId);
    return { reactionCount, myReaction: null };
  },

  async updateComment(viewerId: string, commentId: string, content: string): Promise<CommentDTO> {
    const comment = await postsRepository.getCommentById(commentId);
    if (!comment) throw errors.notFound('Comment not found');
    if (comment.authorId !== viewerId) throw errors.forbidden('You can only edit your own comments');
    const updated = await postsRepository.updateComment(commentId, content.trim());
    const mine = await postsRepository.findCommentReaction(viewerId, commentId);
    return mapComment(updated, viewerId, mine?.type ?? null);
  },

  async deleteComment(viewerId: string, commentId: string): Promise<void> {
    const comment = await postsRepository.getCommentById(commentId);
    if (!comment) throw errors.notFound('Comment not found');
    // The comment's author OR the owner of the post may delete it.
    if (comment.authorId !== viewerId && comment.post.authorId !== viewerId) {
      throw errors.forbidden('You cannot delete this comment');
    }
    await postsRepository.deleteComment(commentId);
  },

  async addComment(viewerId: string, postId: string, input: CreateCommentInput): Promise<CommentDTO> {
    const post = await postsRepository.findPost(postId);
    if (!post) throw errors.notFound('Post not found');
    await this.assertCanViewPost(viewerId, post);
    const comment = await postsRepository.addCommentAndCount({
      post: { connect: { id: postId } },
      author: { connect: { id: viewerId } },
      content: input.content.trim(),
      ...(input.parentId ? { parent: { connect: { id: input.parentId } } } : {}),
    });
    await notificationsService.notify({
      recipientId: post.authorId,
      actorId: viewerId,
      type: 'COMMENT',
      message: 'commented on your post',
      link: `/post/${postId}`,
      entityType: 'Post',
      entityId: postId,
    });
    await this.processCommentMentions(comment.id, postId, post.authorId, viewerId, comment.content);
    return mapComment(comment, viewerId);
  },

  /**
   * Parse @mentions out of a new comment: record Mention rows and notify each
   * mentioned user (linking to the post). #hashtags in comments are linkified
   * client-side but not indexed for the trending feed — there's no comment↔
   * hashtag relation in the schema. The post author is skipped here since they
   * already get a COMMENT notification.
   */
  async processCommentMentions(
    commentId: string,
    postId: string,
    postAuthorId: string,
    commenterId: string,
    content: string,
  ): Promise<void> {
    const handles = extractMentions(content);
    if (handles.length === 0) return;
    const users = (await postsRepository.usersByUsernames(handles)).filter(
      (u) => u.id !== commenterId,
    );
    if (users.length === 0) return;
    await postsRepository.createCommentMentions(commentId, users.map((u) => u.id));
    for (const u of users) {
      if (u.id === postAuthorId) continue; // already notified via COMMENT
      await notificationsService.notify({
        recipientId: u.id,
        actorId: commenterId,
        type: 'MENTION',
        message: 'mentioned you in a comment',
        link: `/post/${postId}`,
        entityType: 'Comment',
        entityId: commentId,
      });
    }
  },
};
