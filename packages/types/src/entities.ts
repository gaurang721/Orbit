import { z } from 'zod';
import type { GroupPrivacy, GroupRole, PageType, ProductCondition, ProductStatus, RSVPStatus } from './enums';
import type { UserRef } from './user';

// ===== Groups ================================================================
export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  description: z.string().trim().max(1000).optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(80),
    description: z.string().trim().max(1000).nullable(),
    privacy: z.enum(['PUBLIC', 'PRIVATE', 'SECRET']),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export interface GroupDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: GroupPrivacy;
  coverPhoto: string | null;
  memberCount: number;
  isMember: boolean;
  myRole: GroupRole | null;
  createdAt: string;
}

// ===== Pages =================================================================
export const createPageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().max(60).optional(),
  about: z.string().trim().max(1000).optional(),
  type: z.enum(['BUSINESS', 'FAN', 'COMMUNITY', 'BRAND', 'PUBLIC_FIGURE']).default('BUSINESS'),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    category: z.string().trim().max(60).nullable(),
    about: z.string().trim().max(1000).nullable(),
    type: z.enum(['BUSINESS', 'FAN', 'COMMUNITY', 'BRAND', 'PUBLIC_FIGURE']),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export interface PageDTO {
  id: string;
  name: string;
  slug: string;
  type: PageType;
  category: string | null;
  about: string | null;
  avatar: string | null;
  coverPhoto: string | null;
  followerCount: number;
  isFollowing: boolean;
  isOwner: boolean;
  createdAt: string;
}

// ===== Marketplace ===========================================================
export const createProductSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional().default(''),
  price: z.coerce.number().nonnegative('Price must be 0 or more'),
  currency: z.string().trim().max(8).default('USD'),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED']).default('USED'),
  categoryId: z.string().optional(),
  location: z.string().trim().max(120).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(4000),
    price: z.coerce.number().nonnegative('Price must be 0 or more'),
    currency: z.string().trim().max(8),
    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED']),
    categoryId: z.string().nullable(),
    location: z.string().trim().max(120).nullable(),
    status: z.enum(['AVAILABLE', 'PENDING', 'SOLD', 'ARCHIVED']),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export interface ProductCategoryDTO {
  id: string;
  name: string;
  slug: string;
}

export interface ProductDTO {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: ProductCondition;
  status: ProductStatus;
  location: string | null;
  images: string[];
  category: ProductCategoryDTO | null;
  seller: UserRef;
  isSaved: boolean;
  isOwn: boolean;
  createdAt: string;
}

// ===== Events ================================================================
export const createEventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional(),
  location: z.string().trim().max(160).optional(),
  isOnline: z.coerce.boolean().optional().default(false),
  onlineUrl: z.string().trim().max(300).optional(),
  startAt: z.string().min(1, 'Start date is required'),
  endAt: z.string().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(4000).nullable(),
    location: z.string().trim().max(160).nullable(),
    isOnline: z.coerce.boolean(),
    onlineUrl: z.string().trim().max(300).nullable(),
    startAt: z.string().min(1),
    endAt: z.string().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const rsvpSchema = z.object({
  status: z.enum(['GOING', 'INTERESTED', 'NOT_GOING']),
});

export interface EventDTO {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  isOnline: boolean;
  onlineUrl: string | null;
  coverPhoto: string | null;
  startAt: string;
  endAt: string | null;
  organizer: UserRef;
  goingCount: number;
  interestedCount: number;
  myRsvp: RSVPStatus | null;
  isOwn: boolean;
  createdAt: string;
}
