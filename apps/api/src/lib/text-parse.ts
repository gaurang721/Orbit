/**
 * Extract #hashtags and @mentions from free-text post content.
 *
 * - Hashtags are lowercased, de-duplicated, 1–50 chars of [A-Za-z0-9_], and
 *   purely-numeric tags (e.g. "#1") are ignored.
 * - Mention handles are de-duplicated (lowercased for the set) and matched
 *   case-insensitively against usernames by the caller.
 *
 * A leading look-behind for a non-word char keeps us from matching mid-word
 * (e.g. "email@host" or "a#b") and from picking up URL fragments.
 */

const HASHTAG_RE = /(?:^|[^\w&])#([A-Za-z0-9_]{1,50})/g;
const MENTION_RE = /(?:^|[^\w])@([A-Za-z0-9_.]{2,30})/g;

export function extractHashtags(content: string): string[] {
  const tags = new Set<string>();
  for (const m of content.matchAll(HASHTAG_RE)) {
    const tag = m[1]!.toLowerCase();
    if (!/^\d+$/.test(tag)) tags.add(tag);
  }
  return [...tags];
}

export function extractMentions(content: string): string[] {
  const handles = new Set<string>();
  for (const m of content.matchAll(MENTION_RE)) {
    // strip a trailing dot so "@ada." resolves to "ada"
    handles.add(m[1]!.replace(/\.+$/, '').toLowerCase());
  }
  return [...handles].filter((h) => h.length >= 2);
}
