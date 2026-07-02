import type { Prisma, ReactionType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** Fields needed to build a UserRef. */
export const userRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  profilePicture: true,
  verified: true,
} satisfies Prisma.UserSelect;

/** Shared relation include for any query that returns a full post DTO. */
export const postInclude = {
  author: { select: userRefSelect },
  media: { orderBy: { position: 'asc' } },
  poll: { include: { options: { orderBy: { position: 'asc' } } } },
  // For SHARE posts: the embedded original (slim — author + media only).
  sharedPost: {
    include: { author: { select: userRefSelect }, media: { orderBy: { position: 'asc' } } },
  },
  tags: { include: { user: { select: userRefSelect } } },
} satisfies Prisma.PostInclude;

export const postsRepository = {
  /** User ids in a block relationship with the viewer (either direction). */
  async blockedUserIds(userId: string): Promise<string[]> {
    const rows = await prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId));
  },

  /** Accepted-friend user ids for a given user. */
  async friendIds(userId: string): Promise<string[]> {
    const rows = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  },

  /** Ids of groups the user belongs to (so their group posts can enter the feed). */
  async memberGroupIds(userId: string): Promise<string[]> {
    const rows = await prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } });
    return rows.map((r) => r.groupId);
  },

  async isGroupMember(userId: string, groupId: string): Promise<boolean> {
    return (await prisma.groupMember.count({ where: { groupId, userId } })) > 0;
  },

  /** Ids of pages the user follows or owns (so their page posts can enter the feed). */
  async feedPageIds(userId: string): Promise<string[]> {
    const [followed, owned] = await Promise.all([
      prisma.pageFollow.findMany({ where: { userId }, select: { pageId: true } }),
      prisma.page.findMany({ where: { ownerId: userId }, select: { id: true } }),
    ]);
    return [...new Set([...followed.map((r) => r.pageId), ...owned.map((r) => r.id)])];
  },

  createPost(data: Prisma.PostCreateInput) {
    return prisma.post.create({ data, include: postInclude });
  },

  incrementShareCount(id: string) {
    return prisma.post.update({ where: { id }, data: { shareCount: { increment: 1 } } });
  },

  createPostTags(postId: string, userIds: string[]) {
    if (userIds.length === 0) return Promise.resolve(undefined);
    return prisma.postTag.createMany({
      data: userIds.map((userId) => ({ postId, userId })),
      skipDuplicates: true,
    });
  },

  /** The viewer's own not-yet-published scheduled posts, soonest first. */
  scheduledPosts(userId: string) {
    return prisma.post.findMany({
      where: { authorId: userId, status: 'SCHEDULED' },
      include: postInclude,
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });
  },

  /** Publish any scheduled posts whose time has arrived. Returns the count. */
  async publishDueScheduledPosts(now: Date) {
    const res = await prisma.post.updateMany({
      where: { status: 'SCHEDULED', scheduledFor: { lte: now } },
      data: { status: 'PUBLISHED', publishedAt: now },
    });
    return res.count;
  },

  findPost(id: string) {
    return prisma.post.findUnique({ where: { id }, include: postInclude });
  },

  feed(where: Prisma.PostWhereInput, take: number, cursor?: string) {
    return prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  },

  /** Per-type reaction counts for a set of posts. */
  reactionCounts(postIds: string[]) {
    return prisma.reaction.groupBy({
      by: ['postId', 'type'],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    });
  },

  /** The viewer's own reactions across a set of posts. */
  myReactions(userId: string, postIds: string[]) {
    return prisma.reaction.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true, type: true },
    });
  },

  findReaction(userId: string, postId: string) {
    return prisma.reaction.findUnique({ where: { userId_postId: { userId, postId } } });
  },

  updatePost(id: string, data: Prisma.PostUpdateInput) {
    return prisma.post.update({ where: { id }, data, include: postInclude });
  },

  deletePost(id: string) {
    // Keep Hashtag.postCount accurate: decrement each linked tag before the
    // post (and its cascade-deleted PostHashtag links) is removed.
    return prisma.$transaction(async (tx) => {
      const links = await tx.postHashtag.findMany({ where: { postId: id }, select: { hashtagId: true } });
      if (links.length) {
        await tx.hashtag.updateMany({
          where: { id: { in: links.map((l) => l.hashtagId) } },
          data: { postCount: { decrement: 1 } },
        });
      }
      return tx.post.delete({ where: { id } });
    });
  },

  // ----- Saved posts ---------------------------------------------------------
  savePost(userId: string, postId: string) {
    return prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
  },

  unsavePost(userId: string, postId: string) {
    return prisma.savedPost.deleteMany({ where: { userId, postId } });
  },

  async listSavedPosts(userId: string) {
    const rows = await prisma.savedPost.findMany({
      where: { userId },
      include: { post: { include: postInclude } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => r.post);
  },

  // ----- Comments ------------------------------------------------------------
  listComments(postId: string) {
    return prisma.comment.findMany({
      where: { postId },
      include: { author: { select: userRefSelect } },
      orderBy: { createdAt: 'asc' },
    });
  },

  createComment(data: Prisma.CommentCreateInput) {
    return prisma.comment.create({
      data,
      include: { author: { select: userRefSelect } },
    });
  },

  getCommentById(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      include: { author: { select: userRefSelect }, post: { select: { authorId: true } } },
    });
  },

  updateComment(id: string, content: string) {
    return prisma.comment.update({
      where: { id },
      data: { content, editedAt: new Date() },
      include: { author: { select: userRefSelect } },
    });
  },

  /** Delete a comment and fix the denormalized counters. */
  deleteComment(id: string) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.comment.delete({ where: { id } });
      await tx.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } });
      if (c.parentId) {
        await tx.comment
          .update({ where: { id: c.parentId }, data: { replyCount: { decrement: 1 } } })
          .catch(() => undefined);
      }
      return c;
    });
  },

  // ----- Comment reactions ---------------------------------------------------
  findCommentReaction(userId: string, commentId: string) {
    return prisma.reaction.findUnique({ where: { userId_commentId: { userId, commentId } } });
  },

  setCommentReaction(userId: string, commentId: string, type: Prisma.ReactionCreateInput['type']) {
    return prisma.$transaction(async (tx) => {
      await tx.reaction.upsert({
        where: { userId_commentId: { userId, commentId } },
        create: { userId, commentId, type },
        update: { type },
      });
      const total = await tx.reaction.count({ where: { commentId } });
      await tx.comment.update({ where: { id: commentId }, data: { reactionCount: total } });
      return total;
    });
  },

  removeCommentReaction(userId: string, commentId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.reaction.deleteMany({ where: { userId, commentId } });
      const total = await tx.reaction.count({ where: { commentId } });
      await tx.comment.update({ where: { id: commentId }, data: { reactionCount: total } });
      return total;
    });
  },

  /** The viewer's own reactions across a set of comments. */
  myCommentReactions(userId: string, commentIds: string[]) {
    if (commentIds.length === 0) return Promise.resolve([] as Array<{ commentId: string | null; type: ReactionType }>);
    return prisma.reaction.findMany({
      where: { userId, commentId: { in: commentIds } },
      select: { commentId: true, type: true },
    });
  },

  // ----- Hashtags & mentions -------------------------------------------------
  /** Upsert each hashtag (bumping postCount) and link it to the post. */
  async syncHashtags(postId: string, tags: string[]) {
    for (const tag of tags) {
      const hashtag = await prisma.hashtag.upsert({
        where: { tag },
        create: { tag, postCount: 1 },
        update: { postCount: { increment: 1 } },
      });
      // (post, hashtag) is unique; ignore the rare race on a duplicate link.
      await prisma.postHashtag.create({ data: { postId, hashtagId: hashtag.id } }).catch(() => undefined);
    }
  },

  /** Of the given user ids, return those that actually exist. */
  existingUserIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([] as string[]);
    return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } }).then((r) => r.map((u) => u.id));
  },

  /** Resolve @handles to real users (case-insensitive username match). */
  usersByUsernames(usernames: string[]) {
    if (usernames.length === 0) return Promise.resolve([] as Array<{ id: string; username: string }>);
    return prisma.user.findMany({
      where: { OR: usernames.map((u) => ({ username: { equals: u, mode: 'insensitive' as const } })) },
      select: { id: true, username: true },
    });
  },

  createMentions(postId: string, userIds: string[]) {
    if (userIds.length === 0) return Promise.resolve(undefined);
    return prisma.mention.createMany({
      data: userIds.map((userId) => ({ postId, userId })),
      skipDuplicates: true,
    });
  },

  createCommentMentions(commentId: string, userIds: string[]) {
    if (userIds.length === 0) return Promise.resolve(undefined);
    return prisma.mention.createMany({
      data: userIds.map((userId) => ({ commentId, userId })),
      skipDuplicates: true,
    });
  },

  findHashtag(tag: string) {
    return prisma.hashtag.findUnique({ where: { tag } });
  },

  trendingHashtags(limit: number) {
    return prisma.hashtag.findMany({
      where: { postCount: { gt: 0 } },
      orderBy: [{ postCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: { tag: true, postCount: true },
    });
  },

  // ----- Polls ---------------------------------------------------------------
  findPollByPostId(postId: string) {
    return prisma.poll.findUnique({
      where: { postId },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  },

  /** Of the given option ids, which ones the viewer has voted for. */
  async votedOptionIds(userId: string, optionIds: string[]): Promise<string[]> {
    if (optionIds.length === 0) return [];
    const rows = await prisma.pollVote.findMany({
      where: { userId, optionId: { in: optionIds } },
      select: { optionId: true },
    });
    return rows.map((r) => r.optionId);
  },

  /**
   * Reconcile a user's votes within one poll to exactly `desiredOptionIds`:
   * add the new ones, remove the dropped ones, then refresh the denormalized
   * `voteCount` on every option that changed. Idempotent.
   */
  setVotes(userId: string, allOptionIds: string[], desiredOptionIds: string[]) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.pollVote.findMany({
        where: { userId, optionId: { in: allOptionIds } },
        select: { optionId: true },
      });
      const currentSet = new Set(current.map((c) => c.optionId));
      const desiredSet = new Set(desiredOptionIds);
      const toAdd = desiredOptionIds.filter((id) => !currentSet.has(id));
      const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));

      if (toRemove.length) {
        await tx.pollVote.deleteMany({ where: { userId, optionId: { in: toRemove } } });
      }
      if (toAdd.length) {
        await tx.pollVote.createMany({
          data: toAdd.map((optionId) => ({ userId, optionId })),
          skipDuplicates: true,
        });
      }
      for (const optionId of new Set([...toAdd, ...toRemove])) {
        const count = await tx.pollVote.count({ where: { optionId } });
        await tx.pollOption.update({ where: { id: optionId }, data: { voteCount: count } });
      }
    });
  },

  // ----- Atomic counter + reaction helpers (run in a transaction) -----------
  setReaction(userId: string, postId: string, type: Prisma.ReactionCreateInput['type']) {
    return prisma.$transaction(async (tx) => {
      await tx.reaction.upsert({
        where: { userId_postId: { userId, postId } },
        create: { userId, postId, type },
        update: { type },
      });
      const total = await tx.reaction.count({ where: { postId } });
      await tx.post.update({ where: { id: postId }, data: { reactionCount: total } });
    });
  },

  removeReaction(userId: string, postId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.reaction.deleteMany({ where: { userId, postId } });
      const total = await tx.reaction.count({ where: { postId } });
      await tx.post.update({ where: { id: postId }, data: { reactionCount: total } });
    });
  },

  async addCommentAndCount(data: Prisma.CommentCreateInput) {
    return prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data,
        include: { author: { select: userRefSelect } },
      });
      await tx.post.update({
        where: { id: comment.postId },
        data: { commentCount: { increment: 1 } },
      });
      if (comment.parentId) {
        await tx.comment.update({
          where: { id: comment.parentId },
          data: { replyCount: { increment: 1 } },
        });
      }
      return comment;
    });
  },
};
