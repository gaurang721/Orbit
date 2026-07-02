'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Flag, Loader2, Search as SearchIcon, Users } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { useSearch } from '@/hooks/use-misc';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { fullName, initials, timeAgo } from '@/lib/utils';

function SearchInner() {
  const q = useSearchParams().get('q') ?? '';
  const { data, isLoading } = useSearch(q);

  if (!q) return <p className="text-muted-foreground">Type in the search bar to find people, posts, groups, pages and items.</p>;
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const r = data;
  const empty = r && r.users.length + r.groups.length + r.pages.length + r.products.length + r.posts.length === 0;
  if (empty) return <p className="text-muted-foreground">No results for “{q}”.</p>;

  return (
    <div className="space-y-5">
      {!!r?.users.length && (
        <Section title="People">
          {r.users.map((u) => (
            <Link key={u.id} href={`/u/${u.username}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
              <Avatar src={u.profilePicture} name={u.firstName} initials={initials(u)} />
              <span className="font-medium">{fullName(u)}</span>
              <span className="text-sm text-muted-foreground">@{u.username}</span>
            </Link>
          ))}
        </Section>
      )}
      {!!r?.posts.length && (
        <Section title="Posts">
          {r.posts.map((p) => (
            <div key={p.id} className="rounded-lg p-2">
              <div className="flex items-center gap-2 text-sm">
                <Avatar src={p.author.profilePicture} name={p.author.firstName} initials={initials(p.author)} size={28} />
                <span className="font-medium">{fullName(p.author)}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm">{p.content}</p>
            </div>
          ))}
        </Section>
      )}
      {!!r?.groups.length && (
        <Section title="Groups">
          {r.groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.slug}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Users className="size-5" /></span>
              <div><div className="font-medium">{g.name}</div><div className="text-xs text-muted-foreground">{g.memberCount} members</div></div>
            </Link>
          ))}
        </Section>
      )}
      {!!r?.pages.length && (
        <Section title="Pages">
          {r.pages.map((p) => (
            <Link key={p.id} href={`/pages/${p.slug}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Flag className="size-5" /></span>
              <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.followerCount} followers</div></div>
            </Link>
          ))}
        </Section>
      )}
      {!!r?.products.length && (
        <Section title="Marketplace">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {r.products.map((p) => (
              <Link key={p.id} href={`/marketplace/${p.id}`} className="overflow-hidden rounded-lg border hover:bg-accent">
                <div className="aspect-square bg-secondary">
                  {p.image ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" className="h-full w-full object-cover" />) : <div className="flex h-full items-center justify-center text-3xl">🛍️</div>}
                </div>
                <div className="p-2"><div className="font-semibold">{p.currency} {p.price}</div><div className="line-clamp-1 text-xs text-muted-foreground">{p.title}</div></div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="mb-2 font-bold">{title}</h2>
      <div className="space-y-1">{children}</div>
    </Card>
  );
}

export default function SearchPage() {
  return (
    <SectionShell title="Search results" max="max-w-3xl">
      <React.Suspense fallback={<Loader2 className="size-6 animate-spin text-primary" />}>
        <SearchInner />
      </React.Suspense>
    </SectionShell>
  );
}
