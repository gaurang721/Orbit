import type { UserRef } from './user';

export interface SearchPostHit {
  id: string;
  content: string | null;
  author: UserRef;
  createdAt: string;
}

export interface SearchResults {
  users: Array<{ id: string; firstName: string; lastName: string; username: string; profilePicture: string | null; verified: boolean }>;
  groups: Array<{ id: string; name: string; slug: string; memberCount: number }>;
  pages: Array<{ id: string; name: string; slug: string; followerCount: number }>;
  products: Array<{ id: string; title: string; price: number; currency: string; image: string | null }>;
  posts: SearchPostHit[];
}
