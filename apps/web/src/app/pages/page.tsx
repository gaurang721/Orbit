'use client';

import * as React from 'react';
import Link from 'next/link';
import { Flag, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SectionShell } from '@/components/layout/section-shell';
import { useCreatePage, usePageFollow, usePages } from '@/hooks/use-entities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function PagesPage() {
  const { data, isLoading } = usePages();
  const create = useCreatePage();
  const follow = usePageFollow();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [about, setAbout] = React.useState('');

  const submit = async () => {
    if (name.trim().length < 2) return toast.error('Page name is too short');
    await create.mutateAsync({ name, category, about, type: 'BUSINESS' });
    setName(''); setCategory(''); setAbout(''); setOpen(false);
    toast.success('Page created');
  };

  return (
    <SectionShell
      title="Pages"
      action={<Button onClick={() => setOpen((v) => !v)}><Plus className="size-4" /> Create page</Button>}
    >
      {open && (
        <Card className="animate-scale-in space-y-3 p-4">
          <Input placeholder="Page name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Category (e.g. Restaurant)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Textarea placeholder="About this page" value={about} onChange={(e) => setAbout(e.target.value)} />
          <Button onClick={submit} disabled={create.isPending}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Create</Button>
        </Card>
      )}

      {isLoading && <Loader2 className="size-6 animate-spin text-primary" />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.pages.map((p) => (
          <Card key={p.id} className="card-hover flex flex-col overflow-hidden">
            <Link href={`/pages/${p.slug}`} className="block h-24 bg-gradient-to-br from-sky-500/40 to-indigo-500/30" />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <Link href={`/pages/${p.slug}`} className="flex items-center gap-2 hover:underline">
                <Flag className="size-4 text-primary" />
                <h3 className="font-bold">{p.name}</h3>
              </Link>
              {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
              <p className="text-xs text-muted-foreground">{p.followerCount} follower{p.followerCount === 1 ? '' : 's'}</p>
              {p.about && <p className="line-clamp-2 text-sm text-muted-foreground">{p.about}</p>}
              <div className="mt-auto pt-2">
                {p.isOwner ? (
                  <Button variant="secondary" size="sm" className="w-full" disabled>You own this</Button>
                ) : (
                  <Button variant={p.isFollowing ? 'secondary' : 'default'} size="sm" className="w-full" onClick={() => follow.mutate({ id: p.id, follow: !p.isFollowing })}>
                    {p.isFollowing ? 'Following' : 'Follow'}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {!isLoading && data?.pages.length === 0 && <p className="text-muted-foreground">No pages yet — create one!</p>}
    </SectionShell>
  );
}
