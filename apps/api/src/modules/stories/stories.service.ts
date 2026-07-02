import type { CreateStoryInput, StoryDTO, StoryGroupDTO, StoryViewerDTO, UserRef } from '@fbclone/types';
import { errors } from '../../utils/http-error.js';
import { publicUrl } from '../../lib/storage.js';
import { friendsRepository } from '../friends/friends.repository.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { storiesRepository } from './stories.repository.js';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

type StoryRow = NonNullable<Awaited<ReturnType<typeof storiesRepository.findById>>>;

interface UploadedFile {
  filename: string;
  mimetype: string;
}

function mapStory(s: StoryRow, hasViewed: boolean): StoryDTO {
  return {
    id: s.id,
    author: s.author,
    type: s.type,
    mediaUrl: s.mediaUrl,
    thumbnailUrl: s.thumbnailUrl,
    caption: s.caption,
    backgroundColor: s.backgroundColor,
    viewCount: s.viewCount,
    hasViewed,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  };
}

export const storiesService = {
  async create(authorId: string, input: CreateStoryInput, file?: UploadedFile): Promise<StoryDTO> {
    if (!file && !input.caption?.trim()) {
      throw errors.badRequest('Add a photo or write something for your story');
    }
    const now = new Date();
    const story = await storiesRepository.create({
      author: { connect: { id: authorId } },
      type: file ? 'IMAGE' : 'TEXT',
      mediaUrl: file ? publicUrl(file.filename) : null,
      caption: input.caption?.trim() || null,
      backgroundColor: input.backgroundColor || null,
      fontStyle: input.fontStyle || null,
      expiresAt: new Date(now.getTime() + STORY_TTL_MS),
    });
    return mapStory(story as StoryRow, true);
  },

  async getFeed(viewerId: string): Promise<StoryGroupDTO[]> {
    const friends = await friendsRepository.friendIds(viewerId);
    const authorIds = [viewerId, ...friends];
    const now = new Date();
    const stories = (await storiesRepository.activeForAuthors(authorIds, now)) as StoryRow[];
    const viewed = await storiesRepository.viewedStoryIds(viewerId, stories.map((s) => s.id));

    // group by author, preserving order (own first)
    const groups = new Map<string, StoryGroupDTO>();
    for (const s of stories) {
      const key = s.authorId;
      if (!groups.has(key)) {
        groups.set(key, { author: s.author as UserRef, stories: [], hasUnseen: false });
      }
      const g = groups.get(key)!;
      const hasViewed = s.authorId === viewerId || viewed.has(s.id);
      g.stories.push(mapStory(s, hasViewed));
      if (!hasViewed) g.hasUnseen = true;
    }

    const ordered = [...groups.values()];
    ordered.sort((a, b) => {
      if (a.author.id === viewerId) return -1;
      if (b.author.id === viewerId) return 1;
      return Number(b.hasUnseen) - Number(a.hasUnseen);
    });
    return ordered;
  },

  async view(viewerId: string, storyId: string): Promise<void> {
    const story = await storiesRepository.findById(storyId);
    if (!story || story.expiresAt < new Date()) throw errors.notFound('Story not found');
    if (story.authorId === viewerId) return; // don't self-view
    await storiesRepository.recordView(storyId, viewerId);
  },

  async viewers(meId: string, storyId: string): Promise<StoryViewerDTO[]> {
    const story = await storiesRepository.findById(storyId);
    if (!story) throw errors.notFound('Story not found');
    if (story.authorId !== meId) throw errors.forbidden('Only the author can see viewers');
    const rows = await storiesRepository.listViewers(storyId);
    return rows.map((r) => ({ user: r.viewer, viewedAt: r.viewedAt.toISOString(), emoji: r.emoji }));
  },

  async react(meId: string, storyId: string, emoji: string): Promise<void> {
    const story = await storiesRepository.findById(storyId);
    if (!story || story.expiresAt < new Date()) throw errors.notFound('Story not found');
    await storiesRepository.react(storyId, meId, emoji);
    await notificationsService.notify({
      recipientId: story.authorId,
      actorId: meId,
      type: 'STORY_REACTION',
      message: `reacted ${emoji} to your story`,
      entityType: 'Story',
      entityId: storyId,
    });
  },

  async remove(meId: string, storyId: string): Promise<void> {
    const story = await storiesRepository.findById(storyId);
    if (!story) throw errors.notFound('Story not found');
    if (story.authorId !== meId) throw errors.forbidden('You can only delete your own story');
    await storiesRepository.delete(storyId);
  },

  /** Periodic hard-delete of expired stories (in addition to query-time filtering). */
  async purgeExpired(): Promise<number> {
    const { count } = await storiesRepository.deleteExpired(new Date());
    return count;
  },
};
