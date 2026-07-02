'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Loader2, Search, Users } from 'lucide-react';
import { useSearch } from '@/hooks/use-misc';
import { Avatar } from '@/components/ui/avatar';
import { fullName, initials } from '@/lib/utils';

/**
 * Top-bar search with a live results dropdown. Typing shows top people / groups
 * / pages as you go (debounced); Enter (or "See all results") opens the full
 * /search page.
 */
export function NavSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [open, setOpen] = React.useState(false);

  // Debounce so we don't hit the API on every keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useSearch(open ? debounced : '');
  const people = data?.users?.slice(0, 5) ?? [];
  const groups = data?.groups?.slice(0, 3) ?? [];
  const pages = data?.pages?.slice(0, 3) ?? [];
  const hasAny = people.length + groups.length + pages.length > 0;
  const trimmed = query.trim();

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="relative hidden sm:block">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) go(`/search?q=${encodeURIComponent(trimmed)}`);
        }}
        className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2"
      >
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          // Delay close so a click on a result still registers.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search Orbit"
          className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>

      {open && trimmed.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border bg-card p-1 shadow-2xl">
          {isFetching && !data && (
            <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-primary" /></div>
          )}

          {people.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); go(`/u/${u.username}`); }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
            >
              <Avatar src={u.profilePicture} name={u.firstName} initials={initials(u)} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{fullName(u)}</span>
                <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
              </span>
            </button>
          ))}

          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); go(`/groups/${g.slug}`); }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary"><Users className="size-4" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{g.name}</span>
                <span className="block text-xs text-muted-foreground">Group · {g.memberCount} members</span>
              </span>
            </button>
          ))}

          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); go(`/pages/${p.slug}`); }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
            >
              <span className="grid size-9 place-items-center rounded-full bg-sky-500/15 text-sky-500"><Flag className="size-4" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">Page · {p.followerCount} followers</span>
              </span>
            </button>
          ))}

          {!isFetching && data && !hasAny && (
            <p className="px-3 py-3 text-sm text-muted-foreground">No results for &ldquo;{trimmed}&rdquo;</p>
          )}

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); go(`/search?q=${encodeURIComponent(trimmed)}`); }}
            className="mt-1 flex w-full items-center gap-2 border-t px-3 py-2.5 text-sm font-medium text-primary hover:bg-accent"
          >
            <Search className="size-4" /> See all results for &ldquo;{trimmed}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}
