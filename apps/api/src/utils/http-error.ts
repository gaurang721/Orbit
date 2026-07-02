/** Application-level error carrying an HTTP status, a stable code, and optional field details. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;
  readonly isOperational = true;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const errors = {
  badRequest: (message = 'Bad request', details?: Record<string, string[]>) =>
    new AppError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Authentication required') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to do that') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message = 'Resource already exists') => new AppError(409, 'CONFLICT', message),
  unprocessable: (message = 'Validation failed', details?: Record<string, string[]>) =>
    new AppError(422, 'VALIDATION_ERROR', message, details),
  tooManyRequests: (message = 'Too many requests') =>
    new AppError(429, 'TOO_MANY_REQUESTS', message),
  internal: (message = 'Something went wrong') => new AppError(500, 'INTERNAL_ERROR', message),
};
