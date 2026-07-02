import type { PrivacyLevel } from './enums';
import type { PublicUser, UserRef } from './user';

/** The viewer's relationship to another user (drives the action button). */
export type RelationStatus =
  | 'self'
  | 'none'
  | 'friends'
  | 'request_sent'
  | 'request_received'
  | 'following'
  | 'blocked';

export interface FriendRequestDTO {
  /** friendship row id */
  id: string;
  user: UserRef;
  createdAt: string;
}

/** A person card (suggestions, search results) with the viewer's relation. */
export interface PersonCardDTO {
  user: PublicUser;
  relation: RelationStatus;
  /** present when relation === 'request_received' */
  requestId?: string;
  mutualCount?: number;
}

/** Full profile-page payload. */
export interface ProfileDTO {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
  coverPhoto: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  createdAt: string;
  friendCount: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  relation: RelationStatus;
  requestId?: string;
  isFollowing: boolean;
  /** true when the viewer has blocked this user */
  isBlocked: boolean;
  isOwn: boolean;
  /** who can see this profile */
  visibility: PrivacyLevel;
  /** true when the viewer can't see the full profile (private + not a friend) */
  limited: boolean;
}
