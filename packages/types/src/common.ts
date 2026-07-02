import { z } from 'zod';

/** Standard success envelope returned by the API. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

/** Standard error envelope returned by the API. */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    /** Field-level validation issues, keyed by dotted path. */
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Cursor-paginated list payload. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

/** Reusable cursor pagination query schema. */
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
