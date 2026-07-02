'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/use-notifications';
import { Avatar } from '@/components/ui/avatar';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { data: count } = useUnreadCount();
  const { data, isLoading } = useNotifications(open);
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const unread = count?.unread ?? 0;
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className="relative flex size-10 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent active:scale-90"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] animate-scale-in items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-20 max-h-[70vh] w-[360px] origin-top-right animate-scale-in overflow-y-auto rounded-xl border bg-card p-2 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-1">
              <h3 className="text-lg font-bold">Notifications</h3>
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            </div>

            {isLoading && <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-primary" /></div>}
            {!isLoading && items.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
            )}

            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.isRead) markOne.mutate(n.id);
                  setOpen(false);
                  if (n.link) router.push(n.link);
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-accent',
                  !n.isRead && 'bg-primary/5',
                )}
              >
                {n.actor ? (
                  <Avatar src={n.actor.profilePicture} name={n.actor.firstName} initials={initials(n.actor)} size={40} />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary"><Bell className="size-5" /></span>
                )}
                <div className="flex-1 text-sm">
                  <span className="font-semibold">{n.actor ? fullName(n.actor) : 'Orbit'}</span>{' '}
                  <span className="text-muted-foreground">{n.message}</span>
                  <div className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" />}
              </button>
            ))}

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-lg px-2 py-2 text-center text-sm font-medium text-primary hover:bg-accent"
            >
              See all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
