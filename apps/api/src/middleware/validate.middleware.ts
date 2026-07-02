import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodTypeAny, z } from 'zod';
import { AppError } from '../utils/http-error.js';

type Source = 'body' | 'query' | 'params';

function flattenZodError(err: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Validate a request segment against a Zod schema. On success the parsed
 * (coerced/defaulted) value replaces the original so handlers get typed input.
 */
export function validate<S extends ZodTypeAny>(schema: S, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new AppError(422, 'VALIDATION_ERROR', 'Validation failed', flattenZodError(result.error)),
      );
      return;
    }
    // query/params are read-only getters in Express 5 but writable in 4; guard anyway.
    try {
      req[source] = result.data as unknown as (typeof req)[typeof source];
    } catch {
      /* ignore — read-only target, handler can re-parse if needed */
    }
    next();
  };
}

export type Infer<S extends ZodTypeAny> = z.infer<S>;
