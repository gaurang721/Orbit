import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';

/** Attach a correlation id to every request and echo it back in the response. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.id = incoming && incoming.length <= 64 ? incoming : nanoid(12);
  res.setHeader('x-request-id', req.id);
  next();
}
