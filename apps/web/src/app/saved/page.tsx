'use client';

import Link from 'next/link';
import { Bookmark, Loader2 } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { useSavedPosts, useSavedProducts } from '@/hooks/use-misc';
import { PostCard } from '@/components/feed/post-card';
import { Card } from '@/components/ui/card';

export default function SavedPage() {
  const posts = useSavedPosts();
  const products = useSavedProducts();

  return (
    <SectionShell title="Saved" max="max-w-2xl">
      <section className="space-y-3">
        <h2 className="font-semibold text-muted-foreground">Saved marketplace items</h2>
        {products.isLoading && <Loader2 className="size-5 animate-spin text-primary" />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.data?.products.map((p) => (
            <Link key={p.id} href={`/marketplace/${p.id}`} className="overflow-hidden rounded-lg border hover:bg-accent">
              <div className="aspect-square bg-secondary">
                {p.images[0] ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={p.images[0]} alt="" className="h-full w-full object-cover" />) : <div className="flex h-full items-center justify-center text-3xl">🛍️</div>}
              </div>
              <div className="p-2"><div className="font-semibold">{p.currency} {p.price}</div><div className="line-clamp-1 text-xs text-muted-foreground">{p.title}</div></div>
            </Link>
          ))}
        </div>
        {!products.isLoading && (products.data?.products.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Nothing saved from Marketplace yet.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-muted-foreground">Saved posts</h2>
        {posts.isLoading && <Loader2 className="size-5 animate-spin text-primary" />}
        {posts.data?.posts.map((post) => <PostCard key={post.id} post={post} />)}
        {!posts.isLoading && (posts.data?.posts.length ?? 0) === 0 && (
          <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Bookmark className="size-5" /> Save posts from the “⋯” menu and they&apos;ll appear here.
          </Card>
        )}
      </section>
    </SectionShell>
  );
}
