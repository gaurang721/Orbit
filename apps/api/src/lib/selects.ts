import type { Prisma } from '@prisma/client';

/** Minimal author/actor projection matching the shared UserRef DTO. */
export const userRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  profilePicture: true,
  verified: true,
} satisfies Prisma.UserSelect;

/** Build a URL-safe slug from a name plus a random suffix for uniqueness. */
export function slugify(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'item'}-${suffix}`;
}
