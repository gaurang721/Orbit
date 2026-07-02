import { open } from 'node:fs/promises';

/**
 * Minimal magic-byte sniffing for the media types we accept. The upload filter
 * trusts the client-supplied `mimetype`, which is forgeable — an attacker can
 * label an HTML/SVG payload as `image/png`. We re-derive the real content
 * category from the file's leading bytes and reject anything that doesn't match.
 *
 * Returns the set of plausible categories for the given header bytes, or null if
 * the signature is unrecognized. Containers like MP4/WebM legitimately hold both
 * audio and video, so they map to multiple categories.
 */
export type MediaCategory = 'image' | 'video' | 'audio' | 'file';

function ascii(buf: Buffer, start: number, end: number): string {
  return buf.subarray(start, end).toString('latin1');
}

export function sniffCategories(buf: Buffer): Set<MediaCategory> | null {
  if (buf.length < 12) return null;

  // ----- Documents ----------------------------------------------------------
  // PDF ("%PDF")
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return new Set(['file']);
  }
  // ZIP container ("PK\x03\x04" / empty "PK\x05\x06" / spanned "PK\x07\x08").
  // Covers .zip and all OOXML docs (.docx/.xlsx/.pptx), which are ZIP archives.
  if (
    buf[0] === 0x50 && buf[1] === 0x4b &&
    ((buf[2] === 0x03 && buf[3] === 0x04) || (buf[2] === 0x05 && buf[3] === 0x06) || (buf[2] === 0x07 && buf[3] === 0x08))
  ) {
    return new Set(['file']);
  }
  // OLE2 compound file (legacy .doc/.xls/.ppt): D0 CF 11 E0 A1 B1 1A E1
  if (
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
    buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1
  ) {
    return new Set(['file']);
  }

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return new Set(['image']);
  // PNG
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return new Set(['image']);
  }
  // GIF ("GIF8")
  if (ascii(buf, 0, 4) === 'GIF8') return new Set(['image']);

  // RIFF container — disambiguate by the form type at bytes 8..12.
  if (ascii(buf, 0, 4) === 'RIFF') {
    const form = ascii(buf, 8, 12);
    if (form === 'WEBP') return new Set(['image']);
    if (form === 'WAVE') return new Set(['audio']);
    if (form === 'AVI ') return new Set(['video']);
    return null;
  }

  // Matroska / WebM (EBML header) — container can carry audio or video.
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return new Set(['video', 'audio']);
  }

  // Ogg ("OggS")
  if (ascii(buf, 0, 4) === 'OggS') return new Set(['audio', 'video']);

  // ISO Base Media (MP4 / QuickTime MOV / M4A) — "ftyp" box at bytes 4..8.
  if (ascii(buf, 4, 8) === 'ftyp') return new Set(['video', 'audio']);

  // MP3 — ID3 tag or MPEG audio frame sync.
  if (ascii(buf, 0, 3) === 'ID3') return new Set(['audio']);
  if (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0) return new Set(['audio']);

  return null;
}

/** Read the leading bytes of a file and return its plausible media categories. */
export async function sniffFileCategories(filePath: string): Promise<Set<MediaCategory> | null> {
  const handle = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buf, 0, 16, 0);
    return sniffCategories(buf.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}
