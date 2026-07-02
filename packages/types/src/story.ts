import { z } from 'zod';
import type { StoryType } from './enums';
import type { UserRef } from './user';

export const createStorySchema = z.object({
  caption: z.string().trim().max(500).optional(),
  backgroundColor: z.string().max(32).optional(),
  fontStyle: z.string().max(32).optional(),
});
export type CreateStoryInput = z.infer<typeof createStorySchema>;

export const reactStorySchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});

export interface StoryDTO {
  id: string;
  author: UserRef;
  type: StoryType;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  backgroundColor: string | null;
  viewCount: number;
  hasViewed: boolean;
  createdAt: string;
  expiresAt: string;
}

/** Active stories from one author, grouped for the story bar. */
export interface StoryGroupDTO {
  author: UserRef;
  stories: StoryDTO[];
  hasUnseen: boolean;
}

export interface StoryViewerDTO {
  user: UserRef;
  viewedAt: string;
  emoji: string | null;
}
