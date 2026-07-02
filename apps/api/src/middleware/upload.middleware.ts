import { open, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { AppError } from '../utils/http-error.js';
import { logger } from '../lib/logger.js';
import { UPLOAD_DIR, persist } from '../lib/storage.js';
import { sniffFileCategories } from '../utils/file-signature.js';

const IMAGE_VIDEO = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

// Documents accepted as file attachments (chat + posts).
const DOC_MIME = new Set([
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
]);
const DOC_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.txt', '.csv']);
const TEXT_MIME = new Set(['text/plain', 'text/csv']);
const TEXT_EXT = new Set(['.txt', '.csv']);

const fileExt = (name: string): string => path.extname(name).toLowerCase();

/** True when a file is a supported document (by MIME, or by extension when the
 *  browser sends the generic application/octet-stream). */
function isDocument(file: Express.Multer.File): boolean {
  if (file.mimetype === 'application/octet-stream') return DOC_EXT.has(fileExt(file.originalname));
  return DOC_MIME.has(file.mimetype) || DOC_EXT.has(fileExt(file.originalname));
}
const isImageOrVideo = (file: Express.Multer.File): boolean => IMAGE_VIDEO.has(file.mimetype);
const isTextLike = (file: Express.Multer.File): boolean =>
  TEXT_MIME.has(file.mimetype) || TEXT_EXT.has(fileExt(file.originalname));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || '.bin';
    cb(null, `${Date.now()}-${nanoid(10)}${ext}`);
  },
});

type MulterFilter = NonNullable<Parameters<typeof multer>[0]>['fileFilter'];
function makeUpload(fileFilter: MulterFilter) {
  return multer({ storage, limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 10 }, fileFilter });
}

// Images/videos only (stories).
const mediaUpload = makeUpload((_req, file, cb) => {
  if (isImageOrVideo(file)) cb(null, true);
  else cb(new AppError(400, 'BAD_REQUEST', 'Only images (JPEG/PNG/GIF/WEBP) and videos (MP4/WEBM/MOV) are allowed'));
});

// Images/videos AND documents (posts/pages/groups composer).
const postUpload = makeUpload((_req, file, cb) => {
  if (isImageOrVideo(file) || isDocument(file)) cb(null, true);
  else cb(new AppError(400, 'BAD_REQUEST', 'Unsupported file type'));
});

// Documents only (chat file attachments).
const docUpload = makeUpload((_req, file, cb) => {
  if (isDocument(file)) cb(null, true);
  else cb(new AppError(400, 'BAD_REQUEST', 'Only documents (PDF, Word, Excel, PowerPoint, ZIP, TXT, CSV) are allowed'));
});

// ----- Magic-byte validation -------------------------------------------------
// multer writes the file to disk before we can inspect it, so we verify the
// real content category *after* upload and delete anything that doesn't match
// the client-declared MIME type (which is forgeable).

type Category = 'image' | 'video' | 'audio' | 'file';

function declaredCategory(file: Express.Multer.File): Category | null {
  const top = file.mimetype.split('/')[0];
  if (top === 'image') return 'image';
  if (top === 'video') return 'video';
  if (top === 'audio') return 'audio';
  if (isDocument(file)) return 'file';
  return null;
}

function collectFiles(req: Request): Express.Multer.File[] {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') return Object.values(req.files).flat();
  return [];
}

async function removeFiles(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(
    files.map((f) =>
      unlink(f.path).catch((err) => logger.warn({ err, path: f.path }, 'failed to clean up upload')),
    ),
  );
}

/** Text files carry no magic bytes; reject only if they look binary (a NUL byte
 *  in the first block is a strong binary signal). */
async function looksBinary(filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buf, 0, 512, 0);
    for (let i = 0; i < bytesRead; i++) if (buf[i] === 0) return true;
    return false;
  } finally {
    await handle.close();
  }
}

/** Verify each uploaded file's real signature, then commit it to storage. */
async function verifyUploads(req: Request): Promise<void> {
  const files = collectFiles(req);
  if (!files.length) return;

  for (const file of files) {
    const cat = declaredCategory(file);
    if (!cat) {
      await removeFiles(files);
      throw new AppError(400, 'BAD_REQUEST', 'Unsupported file type');
    }
    // Text documents (.txt/.csv) have no signature — guard against binary only.
    if (cat === 'file' && isTextLike(file)) {
      if (await looksBinary(file.path)) {
        await removeFiles(files);
        throw new AppError(400, 'BAD_REQUEST', 'File content does not match its declared type');
      }
      continue;
    }
    const sniffed = await sniffFileCategories(file.path);
    if (!sniffed || !sniffed.has(cat)) {
      await removeFiles(files);
      throw new AppError(400, 'BAD_REQUEST', 'File content does not match its declared type');
    }
  }

  // All files are valid — commit them to the active storage backend (a no-op on
  // local disk; an S3 upload + temp-file cleanup when S3 is configured).
  try {
    for (const file of files) await persist(file);
  } catch (err) {
    logger.error({ err }, 'failed to persist upload to storage backend');
    await removeFiles(files);
    throw new AppError(503, 'STORAGE_ERROR', 'Failed to store uploaded file');
  }
}

/** Run a multer middleware, then validate the written files by magic bytes. */
function withValidation(multerMiddleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, (err: unknown) => {
      if (err) {
        next(err);
        return;
      }
      verifyUploads(req).then(() => next()).catch(next);
    });
  };
}

/** Accept up to 10 images/videos/documents under the `images` field (posts). */
export const uploadImages = withValidation(postUpload.array('images', 10));

/** Accept a single optional image/video under the `image` field (e.g. a story). */
export const uploadSingleImage = withValidation(mediaUpload.single('image'));

/** Accept a single document under the `file` field (chat file attachment). */
export const uploadDocument = withValidation(docUpload.single('file'));

/** Accept a single image/video under the `media` field (chat photo/video). */
export const uploadChatMedia = withValidation(mediaUpload.single('media'));

// ----- Voice notes ----------------------------------------------------------
// Browsers record via MediaRecorder, whose Blob mime is codec-tagged
// (e.g. `audio/webm;codecs=opus`). We match by the `audio/` prefix and pick a
// sensible file extension so Express serves a playable Content-Type.
const AUDIO_EXT: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
};

function audioExt(mimetype: string): string {
  const base = mimetype.split(';')[0]!.trim().toLowerCase();
  return AUDIO_EXT[base] ?? '.webm';
}

const voiceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${nanoid(10)}${audioExt(file.mimetype)}`),
});

const voiceUpload = multer({
  storage: voiceStorage,
  // Voice notes are small; cap a little tighter than the generic limit.
  limits: { fileSize: Math.min(env.MAX_UPLOAD_MB, 25) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new AppError(400, 'BAD_REQUEST', 'Only audio recordings are allowed'));
  },
});

/** Accept a single recorded voice note under the `voice` field. */
export const uploadVoice = withValidation(voiceUpload.single('voice'));
