'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarDays, Ban, Camera, Loader2, Lock, MapPin, MessageCircle, Link as LinkIcon, BadgeCheck, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { confirmDialog } from '@/stores/confirm-store';
import { AuthGuard } from '@/components/auth-guard';
import { TopNav } from '@/components/layout/top-nav';
import { FriendButton } from '@/components/friend-button';
import { PostCard } from '@/components/feed/post-card';
import { useBlockUser, useProfile, useUpdateProfile, useUserPosts } from '@/hooks/use-profile';
import { useStartConversation } from '@/hooks/use-chat';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ImageViewer } from '@/components/ui/image-viewer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn, fullName, initials } from '@/lib/utils';

function MessageButton({ userId }: { userId: string }) {
  const router = useRouter();
  const start = useStartConversation();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const { conversation } = await start.mutateAsync(userId);
        router.push(`/messages?c=${conversation.id}`);
      }}
      disabled={start.isPending}
    >
      {start.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />} Message
    </Button>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function BlockButton({ username, isBlocked }: { username: string; isBlocked: boolean }) {
  const block = useBlockUser();
  const onClick = async () => {
    if (isBlocked) {
      block.mutate({ username, block: false }, { onSuccess: () => toast.success('Unblocked') });
      return;
    }
    const ok = await confirmDialog({
      title: `Block @${username}?`,
      message: 'They won’t be able to message you, and you won’t see each other’s posts. Any friendship/follow is removed.',
      confirmText: 'Block',
      destructive: true,
    });
    if (ok) block.mutate({ username, block: true }, { onSuccess: () => toast.success('User blocked') });
  };
  return (
    <Button variant={isBlocked ? 'default' : 'secondary'} onClick={onClick} disabled={block.isPending}>
      {block.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
      {isBlocked ? 'Unblock' : 'Block'}
    </Button>
  );
}

function EditProfileDialog({ onClose }: { onClose: () => void }) {
  const me = useAuthStore((s) => s.user)!;
  const update = useUpdateProfile();
  const [firstName, setFirstName] = React.useState(me.firstName);
  const [lastName, setLastName] = React.useState(me.lastName);
  const [bio, setBio] = React.useState(me.bio ?? '');
  const [location, setLocation] = React.useState(me.location ?? '');
  const [website, setWebsite] = React.useState(me.website ?? '');
  const [visibility, setVisibility] = React.useState<'PUBLIC' | 'FRIENDS' | 'ONLY_ME'>(
    me.profileVisibility === 'FRIENDS' ? 'FRIENDS' : me.profileVisibility === 'ONLY_ME' ? 'ONLY_ME' : 'PUBLIC',
  );
  const avatarInput = React.useRef<HTMLInputElement>(null);
  const coverInput = React.useRef<HTMLInputElement>(null);

  const save = async () => {
    try {
      await update.mutateAsync({ firstName, lastName, bio, location, website, profileVisibility: visibility });
      toast.success('Profile updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not save');
    }
  };

  const upload = async (kind: 'avatar' | 'cover', file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('kind', kind);
    try {
      await update.mutateAsync(fd);
      toast.success(kind === 'cover' ? 'Cover updated' : 'Photo updated');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit profile</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent" aria-label="Close"><X className="size-5" /></button>
        </div>
        <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload('avatar', f); }} />
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload('cover', f); }} />
        <div className="mb-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => avatarInput.current?.click()} disabled={update.isPending}>Change photo</Button>
          <Button variant="secondary" size="sm" onClick={() => coverInput.current?.click()} disabled={update.isPending}>Change cover</Button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <Textarea placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[70px] resize-none" />
          <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <div>
            <label className="text-xs text-muted-foreground">Who can see your profile</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="PUBLIC">🌐 Public — anyone</option>
              <option value="FRIENDS">👥 Friends only</option>
              <option value="ONLY_ME">🔒 Only me</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={update.isPending}>{update.isPending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const username = String(useParams().username ?? '');
  const { data, isLoading, isError } = useProfile(username);
  const posts = useUserPosts(username);
  const [editOpen, setEditOpen] = React.useState(false);
  const [viewer, setViewer] = React.useState<string | null>(null);
  const update = useUpdateProfile();
  const avatarInput = React.useRef<HTMLInputElement>(null);
  const coverInput = React.useRef<HTMLInputElement>(null);

  // Direct avatar/cover upload from the header (own profile).
  const uploadPhoto = async (kind: 'avatar' | 'cover', file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('kind', kind);
    try {
      await update.mutateAsync(fd);
      toast.success(kind === 'cover' ? 'Cover updated' : 'Profile photo updated');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Upload failed');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }
  if (isError || !data) {
    return <p className="py-20 text-center text-muted-foreground">This profile isn&apos;t available.</p>;
  }

  const p = data.profile;
  const allPosts = posts.data?.pages.flatMap((x) => x.items) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      {/* hidden pickers for direct avatar/cover upload */}
      {p.isOwn && (
        <>
          <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto('avatar', f); }} />
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto('cover', f); }} />
        </>
      )}

      {/* cover */}
      <Card className="overflow-hidden">
        <div className="relative">
          <button
            type="button"
            onClick={() => p.coverPhoto && setViewer(p.coverPhoto)}
            disabled={!p.coverPhoto}
            aria-label="View cover photo"
            className={cn(
              'block h-48 w-full bg-gradient-to-br from-primary/40 via-blue-500/30 to-purple-500/30 sm:h-60',
              p.coverPhoto && 'cursor-zoom-in',
            )}
            style={p.coverPhoto ? { backgroundImage: `url(${p.coverPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          />
          {p.isOwn && (
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={update.isPending}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-black/75 disabled:opacity-60"
            >
              <Camera className="size-4" /> Edit cover
            </button>
          )}
        </div>
        <div className="flex flex-col items-center gap-3 px-6 pb-5 sm:flex-row sm:items-end">
          <div className="relative -mt-14 rounded-full ring-4 ring-card">
            {p.profilePicture ? (
              <button type="button" onClick={() => setViewer(p.profilePicture)} className="block cursor-zoom-in rounded-full" aria-label="View profile photo">
                <Avatar src={p.profilePicture} name={p.firstName} initials={initials(p)} size={120} className="text-4xl" />
              </button>
            ) : (
              <Avatar src={p.profilePicture} name={p.firstName} initials={initials(p)} size={120} className="text-4xl" />
            )}
            {p.isOwn && (
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={update.isPending}
                className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full border-2 border-card bg-secondary text-foreground shadow hover:bg-accent disabled:opacity-60"
                aria-label="Change profile photo"
                title="Change profile photo"
              >
                {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
            )}
          </div>
          <div className="flex-1 text-center sm:pb-2 sm:text-left">
            <h1 className="flex items-center justify-center gap-1 text-2xl font-bold sm:justify-start">
              {fullName(p)} {p.verified && <BadgeCheck className="size-5 text-primary" />}
            </h1>
            <p className="text-sm text-muted-foreground">@{p.username} · {p.friendCount} friends · {p.followerCount} followers</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:pb-2">
            {p.isOwn ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="size-4" /> Edit profile</Button>
            ) : (
              <>
                <FriendButton userId={p.id} relation={p.relation} requestId={p.requestId} isFollowing={p.isFollowing} />
                <MessageButton userId={p.id} />
                <BlockButton username={p.username} isBlocked={p.isBlocked} />
              </>
            )}
          </div>
        </div>
      </Card>

      {editOpen && <EditProfileDialog onClose={() => setEditOpen(false)} />}
      {viewer && <ImageViewer src={viewer} alt={fullName(p)} onClose={() => setViewer(null)} />}

      {p.limited ? (
        <Card className="mt-4 flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-secondary"><Lock className="size-7 text-muted-foreground" /></span>
          <h2 className="text-lg font-semibold">This profile is private</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {p.visibility === 'ONLY_ME'
              ? `${p.firstName} keeps their profile private.`
              : `Add ${p.firstName} as a friend to see their posts and details.`}
          </p>
          {p.relation !== 'friends' && p.visibility === 'FRIENDS' && (
            <FriendButton userId={p.id} relation={p.relation} requestId={p.requestId} isFollowing={p.isFollowing} />
          )}
        </Card>
      ) : (
      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_3fr]">
        {/* about / intro */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="text-lg font-bold">Intro</h2>
            {p.bio && <p className="text-sm">{p.bio}</p>}
            {p.location && <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" /> {p.location}</p>}
            {p.website && (
              <a href={p.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <LinkIcon className="size-4" /> {p.website}
              </a>
            )}
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" /> Joined {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex justify-around border-t pt-3">
              <Stat value={p.postCount} label="Posts" />
              <Stat value={p.friendCount} label="Friends" />
              <Stat value={p.followerCount} label="Followers" />
            </div>
          </Card>
        </div>

        {/* posts */}
        <div className="space-y-4">
          {posts.isLoading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>}
          {!posts.isLoading && allPosts.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">No posts yet.</Card>
          )}
          {allPosts.map((post, i) => (
            <div key={post.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
              <PostCard post={post} />
            </div>
          ))}
          {posts.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => posts.fetchNextPage()} disabled={posts.isFetchingNextPage}>
                {posts.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Load more
              </Button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="container py-6">
          <Profile />
        </main>
      </div>
    </AuthGuard>
  );
}
