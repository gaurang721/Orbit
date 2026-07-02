'use client';

import * as React from 'react';
import Link from 'next/link';
import { Hash, Search, TrendingUp, Video } from 'lucide-react';
import { useContacts } from '@/hooks/use-users';
import { useTrendingHashtags } from '@/hooks/use-posts';
import { Avatar } from '@/components/ui/avatar';
import { cn, fullName, initials } from '@/lib/utils';

export function RightSidebar() {
  const { data } = useContacts();
  const contacts = data?.users ?? [];
  const { data: trending } = useTrendingHashtags();
  const hashtags = trending?.hashtags ?? [];

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const query = q.trim().toLowerCase();
  const shown = query
    ? contacts.filter((c) => `${fullName(c)} ${c.username}`.toLowerCase().includes(query))
    : contacts;

  return (
    <aside className="hidden w-[300px] shrink-0 xl:block">
      <div className="sticky top-[72px] space-y-4 overflow-y-auto pl-2">
        {/* trending hashtags */}
        {hashtags.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-muted-foreground">
              <TrendingUp className="size-4" /> Trending
            </h3>
            <div className="space-y-0.5">
              {hashtags.map((h) => (
                <Link
                  key={h.tag}
                  href={`/hashtag/${h.tag}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Hash className="size-4 text-primary" />
                    {h.tag}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {h.postCount} post{h.postCount === 1 ? '' : 's'}
                  </span>
                </Link>
              ))}
            </div>
            <hr className="mt-4" />
          </div>
        )}

        {/* contacts */}
        <div>
          <div className="mb-1 flex items-center justify-between text-muted-foreground">
            <h3 className="font-semibold">Contacts</h3>
            <div className="flex gap-1">
              <Link href="/calls" title="Calls" aria-label="Calls" className="rounded-full p-1.5 hover:bg-accent"><Video className="size-4" /></Link>
              <button
                type="button"
                onClick={() => { setSearchOpen((v) => !v); setQ(''); }}
                title="Search contacts"
                aria-label="Search contacts"
                className={cn('rounded-full p-1.5 hover:bg-accent', searchOpen && 'bg-accent text-primary')}
              >
                <Search className="size-4" />
              </button>
            </div>
          </div>
          {searchOpen && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts"
              className="mb-1 w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          {contacts.length === 0 && <p className="px-2 text-sm text-muted-foreground">No contacts yet.</p>}
          {contacts.length > 0 && shown.length === 0 && (
            <p className="px-2 text-sm text-muted-foreground">No contacts match &ldquo;{q.trim()}&rdquo;.</p>
          )}
          {shown.map((c) => (
            <Link key={c.id} href={`/u/${c.username}`} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
              <div className="relative">
                <Avatar src={c.profilePicture} name={c.firstName} initials={initials(c)} size={36} />
                {c.isOnline && (
                  <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-green-500" />
                )}
              </div>
              <span className="font-medium">{fullName(c)}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
