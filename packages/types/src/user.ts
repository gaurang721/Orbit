import { z } from 'zod';
import type { Gender, PrivacyLevel, RelationshipStatus, Role } from './enums';

/** Editable profile fields (all optional; at least one should be present). */
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(50).optional(),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(100).optional(),
  website: z.string().trim().max(200).optional(),
  /** who can see your profile: PUBLIC (anyone) / FRIENDS / ONLY_ME */
  profileVisibility: z.enum(['PUBLIC', 'FRIENDS', 'ONLY_ME']).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** The authenticated user's own view of their account. */
export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string | null;
  profilePicture: string | null;
  coverPhoto: string | null;
  bio: string | null;
  gender: Gender | null;
  birthday: string | null;
  relationshipStatus: RelationshipStatus | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  role: Role;
  profileVisibility: PrivacyLevel;
  createdAt: string;
  updatedAt: string;
}

/** A trimmed, public-safe representation of a user. */
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
  coverPhoto: string | null;
  bio: string | null;
  verified: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

/** Minimal author/actor reference embedded in posts, comments, notifications. */
export interface UserRef {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
  verified: boolean;
}
