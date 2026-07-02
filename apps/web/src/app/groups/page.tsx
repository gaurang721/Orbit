'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Lock, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { SectionShell } from '@/components/layout/section-shell';
import { useCreateGroup, useGroupMembership, useGroups } from '@/hooks/use-entities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function GroupsPage() {
  const { data, isLoading } = useGroups();
  const create = useCreateGroup();
  const membership = useGroupMembership();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [privacy, setPrivacy] = React.useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  const submit = async () => {
    if (name.trim().length < 2) return toast.error('Group name is too short');
    await create.mutateAsync({ name, description, privacy });
    setName(''); setDescription(''); setOpen(false);
    toast.success('Group created');
  };

  return (
    <SectionShell
      title="Groups"
      action={<Button onClick={() => setOpen((v) => !v)}><Plus className="size-4" /> Create group</Button>}
    >
      {open && (
        <Card className="animate-scale-in space-y-3 p-4">
          <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="What's this group about?" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex items-center gap-3">
            <select value={privacy} onChange={(e) => setPrivacy(e.target.value as 'PUBLIC' | 'PRIVATE')} className="h-10 rounded-md border border-input bg-card px-3 text-sm">
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
            <Button onClick={submit} disabled={create.isPending}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Create</Button>
          </div>
        </Card>
      )}

      {isLoading && <Loader2 className="size-6 animate-spin text-primary" />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.groups.map((g) => (
          <Card key={g.id} className="card-hover flex flex-col overflow-hidden">
            <Link href={`/groups/${g.slug}`} className="block h-24 bg-gradient-to-br from-primary/40 to-purple-500/30" />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <Link href={`/groups/${g.slug}`} className="font-bold hover:underline">{g.name}</Link>
                {g.privacy === 'PRIVATE' && <Lock className="size-3.5 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground"><Users className="mr-1 inline size-3.5" />{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</p>
              {g.description && <p className="line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
              <div className="mt-auto pt-2">
                {g.isMember ? (
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => membership.mutate({ id: g.id, action: 'leave' })}>
                    {g.myRole === 'ADMIN' ? 'Admin · Leave' : 'Joined · Leave'}
                  </Button>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => membership.mutate({ id: g.id, action: 'join' }, { onSuccess: () => toast.success(g.privacy === 'PUBLIC' ? 'Joined!' : 'Request sent') })}>
                    Join group
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {!isLoading && data?.groups.length === 0 && <p className="text-muted-foreground">No groups yet — create the first one!</p>}
    </SectionShell>
  );
}
