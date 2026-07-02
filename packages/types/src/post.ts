import { z } from 'zod';
import type { MediaType, PostType, ReactionType } from './enums';
import type { UserRef } from './user';

// ----- Validation schemas ----------------------------------------------------

// A poll attached to a new post: a question plus 2–8 choices. `durationDays`,
// when set, closes the poll that many days after creation (omit = never closes).
export const createPollSchema = z.object({
  question: z.string().trim().min(1, 'Ask a question').max(300, 'Question is too long'),
  options: z
    .array(z.string().trim().min(1, 'Option cannot be empty').max(120, 'Option is too long'))
    .min(2, 'Add at least two options')
    .max(8, 'A poll can have at most 8 options'),
  allowMultiple: z.boolean().optional().default(false),
  durationDays: z.number().int().min(1).max(30).optional(),
});
export type CreatePollInput = z.infer<typeof createPollSchema>;

// content may be empty when the post has image attachments or a poll — the API
// enforces "text, image, or poll required" since it also sees the uploaded files.
export const createPostSchema = z.object({
  content: z.string().trim().max(5000, 'Posts can be at most 5000 characters').optional().default(''),
  privacy: z.enum(['PUBLIC', 'FRIENDS', 'ONLY_ME']).default('PUBLIC'),
  backgroundColor: z.string().max(32).optional(),
  feeling: z.string().max(64).optional(),
  poll: createPollSchema.optional(),
  // ISO datetime — when set to a future time the post is scheduled, not published.
  scheduledFor: z.string().optional(),
  // user ids to tag ("with …"). Array (JSON) or CSV string (multipart-safe); the
  // service normalizes both. Kept optional so existing callers need not pass it.
  taggedUserIds: z.union([z.array(z.string()), z.string()]).optional(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

// Cast a vote on a poll. The body carries the viewer's full desired selection:
// the server diffs it against existing votes (so this both votes and un-votes).
// An empty array clears the viewer's votes. Single-choice polls reject >1 id.
export const votePollSchema = z.object({
  optionIds: z.array(z.string()).max(8),
});
export type VotePollInput = z.infer<typeof votePollSchema>;

// Editing an existing post. Both fields are optional, but at least one must be
// present — the API rejects an empty patch. Media is not changed on edit.
export const updatePostSchema = z
  .object({
    content: z.string().trim().max(5000, 'Posts can be at most 5000 characters').optional(),
    privacy: z.enum(['PUBLIC', 'FRIENDS', 'ONLY_ME']).optional(),
  })
  .refine((v) => v.content !== undefined || v.privacy !== undefined, {
    message: 'Nothing to update',
  });
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const reactSchema = z.object({
  type: z.enum(['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY']),
});
export type ReactInput = z.infer<typeof reactSchema>;

// Sharing (reposting) an existing post to your own feed, with an optional caption.
export const sharePostSchema = z.object({
  content: z.string().trim().max(5000, 'Caption is too long').optional().default(''),
  privacy: z.enum(['PUBLIC', 'FRIENDS', 'ONLY_ME']).default('PUBLIC'),
});
export type SharePostInput = z.infer<typeof sharePostSchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
  parentId: z.string().optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// ----- Response DTOs ---------------------------------------------------------

export interface ReactionSummary {
  /** counts keyed by reaction type */
  counts: Partial<Record<ReactionType, number>>;
  total: number;
  /** the viewer's own reaction, if any */
  mine: ReactionType | null;
}

export interface MediaDTO {
  id: string;
  url: string;
  type: MediaType;
  width: number | null;
  height: number | null;
  /** MIME type — present for FILE attachments (drives the file-card icon) */
  mimeType: string | null;
  /** bytes — present for FILE attachments */
  size: number | null;
  /** original filename — present for FILE attachments (used as the download name) */
  fileName: string | null;
}

export interface PollOptionDTO {
  id: string;
  text: string;
  voteCount: number;
  /** whether the viewer has voted for this option */
  votedByMe: boolean;
}

export interface PollDTO {
  id: string;
  question: string;
  /** when true, the viewer may select more than one option */
  allowMultiple: boolean;
  expiresAt: string | null;
  /** true once `expiresAt` has passed — no further voting allowed */
  closed: boolean;
  /** total votes cast across all options (sum of per-option counts) */
  totalVotes: number;
  options: PollOptionDTO[];
}

/** A slim embed of the original post shown inside a SHARE post. */
export interface SharedPostDTO {
  id: string;
  author: UserRef;
  content: string | null;
  type: PostType;
  backgroundColor: string | null;
  media: MediaDTO[];
  createdAt: string;
}

export interface PostDTO {
  id: string;
  author: UserRef;
  content: string | null;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'GIF' | 'POLL' | 'BACKGROUND' | 'SHARE';
  privacy: 'PUBLIC' | 'FRIENDS' | 'ONLY_ME' | 'CUSTOM';
  backgroundColor: string | null;
  feeling: string | null;
  media: MediaDTO[];
  poll: PollDTO | null;
  /** the original post, when this is a SHARE (null if unavailable/deleted) */
  sharedPost: SharedPostDTO | null;
  /** people tagged in this post ("with …") */
  taggedUsers: UserRef[];
  /** set when the post is scheduled for future publishing (else null) */
  scheduledFor: string | null;
  createdAt: string;
  editedAt: string | null;
  reactions: ReactionSummary;
  commentCount: number;
  shareCount: number;
  isOwn: boolean;
}

export interface HashtagDTO {
  tag: string;
  postCount: number;
}

export interface CommentDTO {
  id: string;
  postId: string;
  author: UserRef;
  content: string;
  parentId: string | null;
  createdAt: string;
  editedAt: string | null;
  reactionCount: number;
  /** the viewer's own reaction on this comment, if any */
  myReaction: ReactionType | null;
  isOwn: boolean;
}
