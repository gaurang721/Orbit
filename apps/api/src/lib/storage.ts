import { existsSync, mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Media storage with two interchangeable backends behind one tiny interface:
 *
 *  - **disk** (default): multer writes files under UPLOAD_DIR and Express serves
 *    them. Simple, but local disk isn't shared between API replicas.
 *  - **s3**: enabled by setting S3_BUCKET. Validated uploads are pushed to
 *    S3-compatible object storage and the local temp copy is removed, so any
 *    replica can serve any file (via the bucket/CDN). Required for horizontal
 *    scaling.
 *
 * Callers only touch `publicUrl(filename)` and `persist(file)` — they don't know
 * which backend is active.
 */

export const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'));

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

/** Route path under which UPLOAD_DIR is served statically (disk backend). */
export const UPLOAD_ROUTE = '/uploads';

const useS3 = Boolean(env.S3_BUCKET);
export const storageBackend: 'disk' | 's3' = useS3 ? 's3' : 'disk';

const DISK_BASE_URL = env.MEDIA_BASE_URL ?? `${env.API_URL}/uploads`;

let s3: S3Client | null = null;
function s3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: env.S3_REGION ?? 'us-east-1',
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }
  return s3;
}

function s3BaseUrl(): string {
  if (env.S3_PUBLIC_URL) return env.S3_PUBLIC_URL.replace(/\/$/, '');
  const bucket = env.S3_BUCKET!;
  if (env.S3_ENDPOINT) return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}`;
  return `https://${bucket}.s3.${env.S3_REGION ?? 'us-east-1'}.amazonaws.com`;
}

/** Public URL for a stored file (by its filename / object key). */
export function publicUrl(filename: string): string {
  const base = useS3 ? s3BaseUrl() : DISK_BASE_URL;
  return `${base}/${filename}`;
}

interface StoredFile {
  filename: string;
  path: string;
  mimetype: string;
}

/**
 * Commit a freshly-uploaded (and already content-validated) file to the active
 * backend. Disk: no-op — multer already wrote it. S3: upload then drop the local
 * temp copy.
 */
export async function persist(file: StoredFile): Promise<void> {
  if (!useS3) return;
  const body = await readFile(file.path);
  await s3Client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: file.filename,
      Body: body,
      ContentType: file.mimetype,
    }),
  );
  await unlink(file.path).catch((err) =>
    logger.warn({ err, path: file.path }, 'failed to remove temp upload after S3 put'),
  );
}
