'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { EMOJI_CATEGORIES, getRecentEmojis, pushRecentEmoji } from '@/lib/emoji-data';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** positioning classes for the popover wrapper (e.g. 'bottom-full right-0 mb-2') */
  className?: string;
}

const RECENT = 'recent';

// Flatten once for search across every category.
const ALL_EMOJIS: Array<readonly [string, string]> = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

export function EmojiPicker({ onSelect, onClose, className }: EmojiPickerProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState('');
  // Always open on Smileys & Emotion (the Recent tab is still available on click).
  const [activeCat, setActiveCat] = React.useState<string>(EMOJI_CATEGORIES[0]!.id);
  const [recent, setRecent] = React.useState<string[]>([]);

  React.useEffect(() => {
    setRecent(getRecentEmojis());
  }, []);

  // Close on outside click / Escape.
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const pick = (emoji: string) => {
    onSelect(emoji);
    setRecent(pushRecentEmoji(emoji));
  };

  const q = query.trim().toLowerCase();
  const results: Array<readonly [string, string]> = React.useMemo(() => {
    if (q) return ALL_EMOJIS.filter(([char, kw]) => kw.includes(q) || char === q);
    if (activeCat === RECENT) return recent.map((char) => [char, ''] as const);
    return EMOJI_CATEGORIES.find((c) => c.id === activeCat)?.emojis ?? [];
  }, [q, activeCat, recent]);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 w-[324px] max-w-[92vw] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl',
        className,
      )}
      role="dialog"
      aria-label="Emoji picker"
    >
      {/* search */}
      <div className="border-b p-2">
        <div className="flex items-center gap-2 rounded-full bg-muted px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* category tabs (hidden while searching) */}
      {!q && (
        <div className="flex items-center gap-0.5 overflow-x-auto border-b px-1.5 py-1">
          <button
            type="button"
            onClick={() => setActiveCat(RECENT)}
            className={cn(
              'shrink-0 rounded-md px-1.5 py-1 text-lg transition-colors hover:bg-accent',
              activeCat === RECENT && 'bg-accent',
            )}
            title="Recently used"
            aria-label="Recently used"
          >
            🕘
          </button>
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              className={cn(
                'shrink-0 rounded-md px-1.5 py-1 text-lg transition-colors hover:bg-accent',
                activeCat === c.id && 'bg-accent',
              )}
              title={c.name}
              aria-label={c.name}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      {/* section label */}
      <div className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {q ? 'Search results' : activeCat === RECENT ? 'Recently used' : EMOJI_CATEGORIES.find((c) => c.id === activeCat)?.name}
      </div>

      {/* grid */}
      <div className="max-h-[240px] overflow-y-auto p-1.5">
        {results.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {activeCat === RECENT && !q ? 'No recent emoji yet — pick one!' : 'No emoji found'}
          </p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {results.map(([char, kw], i) => (
              <button
                key={`${char}-${i}`}
                type="button"
                onClick={() => pick(char)}
                className="flex size-9 items-center justify-center rounded-md text-xl leading-none transition-transform hover:scale-110 hover:bg-accent"
                title={kw || char}
                aria-label={kw || char}
              >
                {char}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
