import type { Response } from 'express';
import type { ApiError, ApiSuccess } from '@fbclone/types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  message?: string,
): Response<ApiSuccess<T>> {
  return res.status(status).json({ success: true, data, ...(message ? { message } : {}) });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>,
): Response<ApiError> {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}
