'use client';

import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/use-notifications';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

export default function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications(true);
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <SectionShell title="Notifications" max="max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">All notifications</h2>
        {hasUnread && (
          <button
            onClick={() => markAll.mutate()}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <CheckCheck className="size-4" /> Mark all read
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Bell className="size-5" /> You have no notifications yet.
        </Card>
      )}

      <ul className="space-y-1">
        {items.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => {
                if (!n.isRead) markOne.mutate(n.id);
                if (n.link) router.push(n.link);
              }}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:bg-accent',
                !n.isRead && 'border-primary/30 bg-primary/5',
              )}
            >
              {n.actor ? (
                <Avatar src={n.actor.profilePicture} name={n.actor.firstName} initials={initials(n.actor)} size={44} />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bell className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{n.actor ? fullName(n.actor) : 'Orbit'}</span>{' '}
                  <span className="text-muted-foreground">{n.message}</span>
                </p>
                <div className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</div>
              </div>
              {!n.isRead && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" />}
            </button>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : 'Load more'}
          </Button>
        </div>
      )}
    </SectionShell>
  );
}
