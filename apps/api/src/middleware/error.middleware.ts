import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken'; // CJS module — use default import for ESM interop
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/http-error.js';
import { sendError } from '../utils/response.js';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Known, intentional application errors.
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Zod validation errors that escaped the validate() middleware.
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      (details[issue.path.join('.') || '_'] ??= []).push(issue.message);
    }
    sendError(res, 422, 'VALIDATION_ERROR', 'Validation failed', details);
    return;
  }

  // JWT failures.
  if (err instanceof jwt.TokenExpiredError) {
    sendError(res, 401, 'TOKEN_EXPIRED', 'Token has expired');
    return;
  }
  if (err instanceof jwt.JsonWebTokenError) {
    sendError(res, 401, 'INVALID_TOKEN', 'Invalid token');
    return;
  }

  // Prisma errors.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      sendError(res, 409, 'CONFLICT', `A record with this ${target} already exists`);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Record not found');
      return;
    }
  }

  // Unknown / unexpected errors — log full detail, return a safe message.
  logger.error({ err, reqId: req.id, path: req.path }, 'Unhandled error');
  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    env.isProd ? 'Something went wrong' : (err as Error)?.message || 'Internal error',
  );
}
