import { z } from 'zod';

export const postIdParamSchema = z.object({ id: z.string().min(1) });

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
