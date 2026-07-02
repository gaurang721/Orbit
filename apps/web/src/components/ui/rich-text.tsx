import * as React from 'react';
import Link from 'next/link';

// Split on #hashtags and @mentions while keeping the delimiters (capturing group).
const TOKEN = /(#[A-Za-z0-9_]+|@[A-Za-z0-9_.]+)/g;

/**
 * Render post text with clickable #hashtags (→ /hashtag/:tag) and @mentions
 * (→ /u/:username). Purely-numeric hashtags (e.g. "#1") render as plain text,
 * mirroring how the API indexes them.
 *
 * `linkClassName` overrides the link styling — pass a contrasting value when the
 * text sits on a colored background (e.g. a chat bubble in the primary color,
 * where the default blue link would be invisible).
 */
export function RichText({
  text,
  className,
  linkClassName = 'text-primary hover:underline',
}: {
  text: string;
  className?: string;
  linkClassName?: string;
}) {
  const parts = text.split(TOKEN);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^#[A-Za-z0-9_]+$/.test(part) && !/^#\d+$/.test(part)) {
          return (
            <Link key={i} href={`/hashtag/${part.slice(1).toLowerCase()}`} className={linkClassName}>
              {part}
            </Link>
          );
        }
        if (/^@[A-Za-z0-9_.]{2,}$/.test(part)) {
          return (
            <Link key={i} href={`/u/${part.slice(1).replace(/\.+$/, '')}`} className={linkClassName}>
              {part}
            </Link>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
