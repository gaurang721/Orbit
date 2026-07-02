'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { TopNav } from '@/components/layout/top-nav';
import { PostCard } from '@/components/feed/post-card';
import { usePost } from '@/hooks/use-posts';

function SinglePost({ id }: { id: string }) {
  const { data, isLoading, isError } = usePost(id);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to feed
      </Link>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="text-lg font-semibold">Post not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted, or you don&apos;t have permission to view it.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Go to your feed
          </Link>
        </div>
      )}

      {data?.post && <PostCard post={data.post} />}
    </div>
  );
}

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <TopNav />
        <SinglePost id={id} />
      </div>
    </AuthGuard>
  );
}
