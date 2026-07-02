export { cn } from '@fbclone/ui';

/** Build a full name from a user-like object. */
export function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

/** Initials for avatar fallbacks. */
export function initials(u: { firstName: string; lastName: string }): string {
  return `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase();
}

/** Human-readable file size, e.g. "512 B", "3.4 KB", "1.2 MB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/** Compact relative time, e.g. "just now", "5m", "3h", "2d", or a date. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
