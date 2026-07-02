'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Images, Loader2, Lock, Pencil, ShieldCheck, Trash2, UserMinus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { GroupDTO } from '@fbclone/types';
import { ApiClientError } from '@/lib/api-client';
import { confirmDialog } from '@/stores/confirm-store';
import { useDeleteGroup, useGroup, useGroupAdminAction, useGroupMembership, useGroupRequests, useUpdateGroup } from '@/hooks/use-entities';
import { useCreateGroupPost, useGroupPosts } from '@/hooks/use-posts';
import { useAuthStore } from '@/stores/auth-store';
import { SectionShell } from '@/components/layout/section-shell';
import { PostCard } from '@/components/feed/post-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { initials } from '@/lib/utils';

type GroupMember = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
  verified: boolean;
  role: string;
};

const PRIVACY_LABEL: Record<GroupDTO['privacy'], string> = {
  PUBLIC: 'Public group',
  PRIVATE: 'Private group',
  SECRET: 'Secret group',
};

export default function GroupDetailRoute() {
  const params = useParams();
  const slug = String(params?.slug ?? '');
  return (
    <SectionShell max="max-w-2xl">
      <GroupDetail slug={slug} />
    </SectionShell>
  );
}

function EditGroupDialog({ slug, group, onClose }: { slug: string; group: GroupDTO; onClose: () => void }) {
  const update = useUpdateGroup(slug);
  const [name, setName] = React.useState(group.name);
  const [description, setDescription] = React.useState(group.description ?? '');
  const [privacy, setPrivacy] = React.useState(group.privacy);

  const save = async () => {
    try {
      await update.mutateAsync({ id: group.id, input: { name: name.trim(), description: description.trim() || null, privacy } });
      toast.success('Group updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update group');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Edit group</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-accent"><X className="size-5" /></button>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        <select value={privacy} onChange={(e) => setPrivacy(e.target.value as GroupDTO['privacy'])} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="PUBLIC">Public group</option>
          <option value="PRIVATE">Private group</option>
          <option value="SECRET">Secret group</option>
        </select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>{update.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}</Button>
        </div>
      </Card>
    </div>
  );
}

function GroupDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useGroup(slug);
  const membership = useGroupMembership();
  const deleteGroup = useDeleteGroup();
  const [editing, setEditing] = React.useState(false);
  const group = data?.group;
  const members = data?.members ?? [];

  const onDelete = async () => {
    if (!group) return;
    const ok = await confirmDialog({
      title: 'Delete group?',
      message: 'This permanently deletes the group, its members, and all its posts. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteGroup.mutateAsync(group.id);
      toast.success('Group deleted');
      router.push('/groups');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete group');
    }
  };

  if (isLoading) {
    return <Loader2 className="mx-auto size-7 animate-spin text-primary" />;
  }

  if (isError || !group) {
    return (
      <Card className="space-y-3 p-8 text-center">
        <Users className="mx-auto size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Group not found</h2>
        <p className="text-sm text-muted-foreground">This group may be secret, removed, or the link is wrong.</p>
        <Link href="/groups" className="text-sm font-medium text-primary hover:underline">
          ← Back to Groups
        </Link>
      </Card>
    );
  }

  const canSeePosts = group.privacy === 'PUBLIC' || group.isMember;

  return (
    <div className="space-y-5">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Groups
      </Link>

      {/* header */}
      <Card className="overflow-hidden">
        <div
          className="h-36 bg-gradient-to-br from-primary/40 to-purple-500/30"
          style={group.coverPhoto ? { backgroundImage: `url(${group.coverPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                {group.name}
                {group.privacy !== 'PUBLIC' && <Lock className="size-4 text-muted-foreground" />}
              </h1>
              <p className="text-sm text-muted-foreground">
                {PRIVACY_LABEL[group.privacy]} · {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
              </p>
            </div>
            <Button
              variant={group.isMember ? 'secondary' : 'default'}
              size="sm"
              disabled={membership.isPending}
              onClick={() =>
                membership.mutate(
                  { id: group.id, action: group.isMember ? 'leave' : 'join' },
                  {
                    onSuccess: () =>
                      toast.success(
                        group.isMember ? 'Left group' : group.privacy === 'PUBLIC' ? 'Joined!' : 'Request sent',
                      ),
                  },
                )
              }
            >
              {membership.isPending && <Loader2 className="size-4 animate-spin" />}
              {group.isMember ? (group.myRole === 'ADMIN' ? 'Admin · Leave' : 'Joined · Leave') : 'Join group'}
            </Button>
          </div>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
          {group.myRole === 'ADMIN' && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit group</Button>
              <Button variant="secondary" size="sm" className="text-destructive" onClick={onDelete} disabled={deleteGroup.isPending}><Trash2 className="size-4" /> Delete</Button>
            </div>
          )}
          {members.length > 0 && <MembersStrip members={members} />}
        </div>
      </Card>

      {editing && group && <EditGroupDialog slug={slug} group={group} onClose={() => setEditing(false)} />}

      {group.myRole === 'ADMIN' && <GroupAdminPanel group={group} members={members} />}

      {group.isMember && <GroupComposer groupId={group.id} />}

      {canSeePosts ? (
        <GroupPostsFeed groupId={group.id} isMember={group.isMember} />
      ) : (
        <Card className="space-y-2 p-8 text-center">
          <Lock className="mx-auto size-7 text-muted-foreground" />
          <h3 className="font-semibold">This group is private</h3>
          <p className="text-sm text-muted-foreground">Join the group to see and share posts.</p>
        </Card>
      )}
    </div>
  );
}

function GroupAdminPanel({ group, members }: { group: GroupDTO; members: GroupMember[] }) {
  const requests = useGroupRequests(group.id, group.privacy !== 'PUBLIC');
  const action = useGroupAdminAction();
  const me = useAuthStore((s) => s.user)!;

  const removeMember = async (m: GroupMember) => {
    const ok = await confirmDialog({
      title: `Remove ${m.firstName}?`,
      message: `Remove ${m.firstName} ${m.lastName} from the group?`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) action.mutate({ groupId: group.id, path: `members/${m.id}/remove` }, { onSuccess: () => toast.success('Removed') });
  };

  const pending = requests.data?.requests ?? [];

  return (
    <Card className="space-y-4 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> Admin tools</h3>

      {group.privacy !== 'PUBLIC' && (
        <div>
          <div className="mb-2 text-sm font-medium text-muted-foreground">Pending requests ({pending.length})</div>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Avatar src={r.user.profilePicture} name={r.user.firstName} initials={`${r.user.firstName[0] ?? ''}${r.user.lastName[0] ?? ''}`} size={32} />
                  <Link href={`/u/${r.user.username}`} className="flex-1 text-sm font-medium hover:underline">
                    {r.user.firstName} {r.user.lastName}
                  </Link>
                  <Button size="sm" onClick={() => action.mutate({ groupId: group.id, path: `requests/${r.user.id}/approve` }, { onSuccess: () => toast.success('Approved') })}>
                    <Check className="size-4" /> Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => action.mutate({ groupId: group.id, path: `requests/${r.user.id}/reject` }, { onSuccess: () => toast.success('Rejected') })}>
                    Reject
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">Members</div>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <Avatar src={m.profilePicture} name={m.firstName} initials={`${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`} size={32} />
              <Link href={`/u/${m.username}`} className="flex-1 text-sm font-medium hover:underline">
                {m.firstName} {m.lastName}
              </Link>
              <span className="text-xs text-muted-foreground">{m.role}</span>
              {m.id !== me.id && m.role !== 'ADMIN' && (
                <button onClick={() => removeMember(m)} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remove member" aria-label="Remove member">
                  <UserMinus className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MembersStrip({ members }: { members: GroupMember[] }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex -space-x-2">
        {members.slice(0, 8).map((m) => (
          <Link key={m.id} href={`/u/${m.username}`} title={`${m.firstName} ${m.lastName}`}>
            <Avatar
              src={m.profilePicture}
              name={m.firstName}
              initials={`${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase()}
              size={32}
              className="ring-2 ring-card"
            />
          </Link>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {members.length} member{members.length === 1 ? '' : 's'} shown
      </span>
    </div>
  );
}

function GroupComposer({ groupId }: { groupId: string }) {
  const me = useAuthStore((s) => s.user)!;
  const create = useCreateGroupPost(groupId);
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
      toast.success('Posted to the group');
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
          placeholder="Write something to the group…"
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

function GroupPostsFeed({ groupId, isMember }: { groupId: string; isMember: boolean }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useGroupPosts(groupId);
  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-primary" />;

  if (posts.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {isMember ? 'No posts yet — start the conversation above! ✍️' : 'This group hasn’t posted anything yet.'}
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
