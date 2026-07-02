/**
 * String-union mirrors of the Prisma enums.
 *
 * These intentionally duplicate the Prisma enum values so the frontend can
 * depend on `@fbclone/types` without pulling in `@prisma/client`. Keep these in
 * sync with `prisma/schema.prisma`.
 */

export const Role = ['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof Role)[number];

export const Gender = ['MALE', 'FEMALE', 'CUSTOM', 'PREFER_NOT_TO_SAY'] as const;
export type Gender = (typeof Gender)[number];

export const RelationshipStatus = [
  'SINGLE',
  'IN_A_RELATIONSHIP',
  'ENGAGED',
  'MARRIED',
  'COMPLICATED',
  'SEPARATED',
  'DIVORCED',
  'WIDOWED',
] as const;
export type RelationshipStatus = (typeof RelationshipStatus)[number];

export const PrivacyLevel = ['PUBLIC', 'FRIENDS', 'ONLY_ME', 'CUSTOM'] as const;
export type PrivacyLevel = (typeof PrivacyLevel)[number];

export const PostType = ['TEXT', 'IMAGE', 'VIDEO', 'GIF', 'POLL', 'BACKGROUND', 'SHARE'] as const;
export type PostType = (typeof PostType)[number];

export const PostStatus = ['PUBLISHED', 'SCHEDULED', 'ARCHIVED', 'DRAFT'] as const;
export type PostStatus = (typeof PostStatus)[number];

export const MediaType = ['IMAGE', 'VIDEO', 'GIF', 'AUDIO', 'FILE'] as const;
export type MediaType = (typeof MediaType)[number];

export const ReactionType = ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const;
export type ReactionType = (typeof ReactionType)[number];

export const FriendshipStatus = ['PENDING', 'ACCEPTED', 'DECLINED'] as const;
export type FriendshipStatus = (typeof FriendshipStatus)[number];

export const NotificationType = [
  'REACTION',
  'COMMENT',
  'COMMENT_REACTION',
  'FRIEND_REQUEST',
  'FRIEND_ACCEPT',
  'FOLLOW',
  'MESSAGE',
  'MENTION',
  'SHARE',
  'TAG',
  'GROUP_INVITE',
  'GROUP_JOIN_REQUEST',
  'GROUP_POST',
  'PAGE_FOLLOW',
  'EVENT_INVITE',
  'EVENT_REMINDER',
  'STORY_REACTION',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NotificationType)[number];

export const MessageType = [
  'TEXT',
  'IMAGE',
  'VIDEO',
  'VOICE',
  'FILE',
  'GIF',
  'STICKER',
  'SYSTEM',
] as const;
export type MessageType = (typeof MessageType)[number];

export const GroupPrivacy = ['PUBLIC', 'PRIVATE', 'SECRET'] as const;
export type GroupPrivacy = (typeof GroupPrivacy)[number];

export const ConversationRole = ['MEMBER', 'ADMIN'] as const;
export type ConversationRole = (typeof ConversationRole)[number];

export const PageType = ['BUSINESS', 'FAN', 'COMMUNITY', 'BRAND', 'PUBLIC_FIGURE'] as const;
export type PageType = (typeof PageType)[number];

export const RSVPStatus = ['GOING', 'INTERESTED', 'NOT_GOING', 'INVITED'] as const;
export type RSVPStatus = (typeof RSVPStatus)[number];

export const StoryType = ['IMAGE', 'VIDEO', 'TEXT'] as const;
export type StoryType = (typeof StoryType)[number];

export const GroupRole = ['MEMBER', 'MODERATOR', 'ADMIN'] as const;
export type GroupRole = (typeof GroupRole)[number];

export const ProductCondition = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'] as const;
export type ProductCondition = (typeof ProductCondition)[number];

export const ProductStatus = ['AVAILABLE', 'PENDING', 'SOLD', 'ARCHIVED'] as const;
export type ProductStatus = (typeof ProductStatus)[number];

export const ReportStatus = ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof ReportStatus)[number];

export const ReportTargetType = [
  'USER',
  'POST',
  'COMMENT',
  'MESSAGE',
  'GROUP',
  'PAGE',
  'PRODUCT',
  'STORY',
] as const;
export type ReportTargetType = (typeof ReportTargetType)[number];

/** UI metadata for the Facebook-style reaction palette. */
export const REACTION_META: Record<ReactionType, { emoji: string; label: string; color: string }> =
  {
    LIKE: { emoji: '👍', label: 'Like', color: '#1877F2' },
    LOVE: { emoji: '❤️', label: 'Love', color: '#F33E58' },
    CARE: { emoji: '🤗', label: 'Care', color: '#F7B125' },
    HAHA: { emoji: '😆', label: 'Haha', color: '#F7B125' },
    WOW: { emoji: '😮', label: 'Wow', color: '#F7B125' },
    SAD: { emoji: '😢', label: 'Sad', color: '#F7B125' },
    ANGRY: { emoji: '😡', label: 'Angry', color: '#E9710F' },
  };
