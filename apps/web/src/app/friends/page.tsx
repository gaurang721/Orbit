'use client';

import Link from 'next/link';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth-guard';
import { TopNav } from '@/components/layout/top-nav';
import {
  useFriendRequests,
  useFriends,
  useRespondRequest,
  useSendRequest,
  useSuggestions,
  useUnfriend,
} from '@/hooks/use-friends';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirmDialog } from '@/stores/confirm-store';
import { fullName, initials } from '@/lib/utils';

function Page() {
  const requests = useFriendRequests();
  const suggestions = useSuggestions();
  const friends = useFriends();
  const respond = useRespondRequest();
  const send = useSendRequest();
  const unfriend = useUnfriend();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="container max-w-3xl space-y-6 py-6">
        <h1 className="text-2xl font-bold">Friends</h1>

        {/* requests */}
        <section className="space-y-3">
          <h2 className="font-semibold text-muted-foreground">Friend requests</h2>
          {requests.isLoading && <Loader2 className="size-5 animate-spin text-primary" />}
          {!requests.isLoading && (requests.data?.requests.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {requests.data?.requests.map((r) => (
              <Card key={r.id} className="flex items-center gap-3 p-3">
                <Link href={`/u/${r.user.username}`}>
                  <Avatar src={r.user.profilePicture} name={r.user.firstName} initials={initials(r.user)} size={48} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${r.user.username}`} className="truncate font-semibold hover:underline">
                    {fullName(r.user)}
                  </Link>
                  <div className="mt-1 flex gap-2">
                    <Button size="sm" onClick={() => respond.mutate({ id: r.id, accept: true })}>
                      <Check className="size-4" /> Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (
                          await confirmDialog({
                            title: 'Delete request?',
                            message: `Decline the friend request from ${fullName(r.user)}?`,
                            confirmText: 'Delete',
                            destructive: true,
                          })
                        )
                          respond.mutate({ id: r.id, accept: false });
                      }}
                    >
                      <X className="size-4" /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* suggestions */}
        <section className="space-y-3">
          <h2 className="font-semibold text-muted-foreground">People you may know</h2>
          {suggestions.isLoading && <Loader2 className="size-5 animate-spin text-primary" />}
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.data?.suggestions.map((s) => (
              <Card key={s.user.id} className="flex items-center gap-3 p-3">
                <Link href={`/u/${s.user.username}`}>
                  <Avatar src={s.user.profilePicture} name={s.user.firstName} initials={initials(s.user)} size={48} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${s.user.username}`} className="truncate font-semibold hover:underline">
                    {fullName(s.user)}
                  </Link>
                  <div className="mt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        send.mutate(s.user.id);
                        toast.success('Friend request sent');
                      }}
                    >
                      <UserPlus className="size-4" /> Add friend
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {!suggestions.isLoading && (suggestions.data?.suggestions.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No suggestions right now.</p>
            )}
          </div>
        </section>

        {/* my friends */}
        <section className="space-y-3">
          <h2 className="font-semibold text-muted-foreground">
            Your friends {friends.data ? `(${friends.data.friends.length})` : ''}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {friends.data?.friends.map((f) => (
              <Card key={f.id} className="flex items-center gap-3 p-3">
                <Link href={`/u/${f.username}`}>
                  <Avatar src={f.profilePicture} name={f.firstName} initials={initials(f)} size={48} />
                </Link>
                <Link href={`/u/${f.username}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                  {fullName(f)}
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (
                      await confirmDialog({
                        title: 'Unfriend?',
                        message: `Remove ${fullName(f)} from your friends?`,
                        confirmText: 'Unfriend',
                        destructive: true,
                      })
                    )
                      unfriend.mutate(f.id);
                  }}
                >
                  Unfriend
                </Button>
              </Card>
            ))}
            {friends.data && friends.data.friends.length === 0 && (
              <p className="text-sm text-muted-foreground">No friends yet — add some above!</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <AuthGuard>
      <Page />
    </AuthGuard>
  );
}
