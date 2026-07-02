'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Flag, Images, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PageDTO } from '@fbclone/types';
import { ApiClientError } from '@/lib/api-client';
import { useDeletePage, usePage, usePageFollow, useUpdatePage } from '@/hooks/use-entities';
import { useCreatePagePost, usePagePosts } from '@/hooks/use-posts';
import { useAuthStore } from '@/stores/auth-store';
import { SectionShell } from '@/components/layout/section-shell';
import { PostCard } from '@/components/feed/post-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { confirmDialog } from '@/stores/confirm-store';
import { initials } from '@/lib/utils';

const PAGE_TYPE_LABEL: Record<PageDTO['type'], string> = {
  BUSINESS: 'Business',
  FAN: 'Fan page',
  COMMUNITY: 'Community',
  BRAND: 'Brand',
  PUBLIC_FIGURE: 'Public figure',
};

export default function PageDetailRoute() {
  const params = useParams();
  const slug = String(params?.slug ?? '');
  return (
    <SectionShell max="max-w-2xl">
      <PageDetail slug={slug} />
    </SectionShell>
  );
}

function EditPageDialog({ slug, page, onClose }: { slug: string; page: PageDTO; onClose: () => void }) {
  const update = useUpdatePage(slug);
  const [name, setName] = React.useState(page.name);
  const [category, setCategory] = React.useState(page.category ?? '');
  const [about, setAbout] = React.useState(page.about ?? '');
  const [type, setType] = React.useState(page.type);

  const save = async () => {
    try {
      await update.mutateAsync({
        id: page.id,
        input: { name: name.trim(), category: category.trim() || null, about: about.trim() || null, type },
      });
      toast.success('Page updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update page');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Edit page</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-accent"><X className="size-5" /></button>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Page name" />
        <select value={type} onChange={(e) => setType(e.target.value as PageDTO['type'])} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
          {(Object.keys(PAGE_TYPE_LABEL) as PageDTO['type'][]).map((t) => <option key={t} value={t}>{PAGE_TYPE_LABEL[t]}</option>)}
        </select>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (optional)" />
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="About" rows={4} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>{update.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}</Button>
        </div>
      </Card>
    </div>
  );
}

function PageDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = usePage(slug);
  const follow = usePageFollow();
  const deletePage = useDeletePage();
  const [editing, setEditing] = React.useState(false);
  const page = data?.page;

  const onDelete = async () => {
    if (!page) return;
    const ok = await confirmDialog({
      title: 'Delete page?',
      message: 'This permanently deletes the page and its posts. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePage.mutateAsync(page.id);
      toast.success('Page deleted');
      router.push('/pages');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete page');
    }
  };

  if (isLoading) {
    return <Loader2 className="mx-auto size-7 animate-spin text-primary" />;
  }

  if (isError || !page) {
    return (
      <Card className="space-y-3 p-8 text-center">
        <Flag className="mx-auto size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground">This page may have been removed or the link is wrong.</p>
        <Link href="/pages" className="text-sm font-medium text-primary hover:underline">
          ← Back to Pages
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/pages" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Pages
      </Link>

      {/* header */}
      <Card className="overflow-hidden">
        <div
          className="h-36 bg-gradient-to-br from-sky-500/40 to-indigo-500/30"
          style={page.coverPhoto ? { backgroundImage: `url(${page.coverPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="-mt-12 flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-card bg-muted">
            {page.avatar ? (
              <Avatar src={page.avatar} name={page.name} initials={page.name.slice(0, 2).toUpperCase()} size={72} />
            ) : (
              <Flag className="size-8 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{page.name}</h1>
            <p className="text-sm text-muted-foreground">
              {PAGE_TYPE_LABEL[page.type]}
              {page.category ? ` · ${page.category}` : ''} · {page.followerCount} follower{page.followerCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex gap-2">
            {page.isOwner ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>
                <Button variant="secondary" size="sm" className="text-destructive" onClick={onDelete} disabled={deletePage.isPending}><Trash2 className="size-4" /> Delete</Button>
              </>
            ) : (
              <Button
                variant={page.isFollowing ? 'secondary' : 'default'}
                size="sm"
                onClick={() => follow.mutate({ id: page.id, follow: !page.isFollowing })}
              >
                {page.isFollowing ? 'Following' : 'Follow'}
              </Button>
            )}
          </div>
        </div>
        {page.about && <p className="border-t px-4 py-3 text-sm text-muted-foreground">{page.about}</p>}
      </Card>

      {editing && <EditPageDialog slug={slug} page={page} onClose={() => setEditing(false)} />}

      {page.isOwner && <PageComposer pageId={page.id} />}

      <PagePostsFeed pageId={page.id} isOwner={page.isOwner} />
    </div>
  );
}

function PageComposer({ pageId }: { pageId: string }) {
  const me = useAuthStore((s) => s.user)!;
  const create = useCreatePagePost(pageId);
  const [content, setContent] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const previews = React.useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  React.useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const canPost = (content.trim().length > 0 || files.length > 0) && !create.isPending;

  const submit = async () => {
    if (!content.trim() && files.length === 0) return;
    try {
      if (files.length > 0) {
        const fd = new FormData();
        fd.append('content', content);
        fd.append('privacy', 'PUBLIC');
        files.forEach((f) => fd.append('images', f));
        await create.mutateAsync(fd);
      } else {
        await create.mutateAsync({ content, privacy: 'PUBLIC' });
      }
      setContent('');
      setFiles([]);
      toast.success('Posted to your page');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not post');
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) setFiles((prev) => [...prev, ...picked].slice(0, 10));
          e.target.value = '';
        }}
      />
      <div className="flex items-start gap-3">
        <Avatar src={me.profilePicture} name={me.firstName} initials={initials(me)} />
        <Textarea
          placeholder="Share an update from your page…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[70px] resize-none border-0 text-base focus-visible:ring-0"
        />
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((url, i) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-md border">
              {files[i]?.type.startsWith('video/') ? (
                <video src={url} className="h-full w-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                aria-label="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Images className="size-4 text-green-600" /> Photo/Video
        </button>
        <Button size="sm" onClick={submit} disabled={!canPost}>
          {create.isPending && <Loader2 className="size-4 animate-spin" />} Post
        </Button>
      </div>
    </Card>
  );
}

function PagePostsFeed({ pageId, isOwner }: { pageId: string; isOwner: boolean }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePagePosts(pageId);
  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-primary" />;

  if (posts.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {isOwner ? 'Nothing posted yet — share your first update above! ✍️' : 'This page hasn’t posted anything yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}
