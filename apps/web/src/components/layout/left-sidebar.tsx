'use client';

import Link from 'next/link';
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Clock,
  Flag,
  Phone,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/avatar';
import { fullName, initials } from '@/lib/utils';

const ITEMS = [
  { icon: Users, label: 'Friends', color: 'text-blue-500', href: '/friends' },
  { icon: Phone, label: 'Calls', color: 'text-green-500', href: '/calls' },
  { icon: Users, label: 'Groups', color: 'text-sky-500', href: '/groups' },
  { icon: Store, label: 'Marketplace', color: 'text-emerald-500', href: '/marketplace' },
  { icon: Clapperboard, label: 'Video', color: 'text-pink-500', href: '/watch' },
  { icon: Clock, label: 'Memories', color: 'text-indigo-500', href: '/memories' },
  { icon: Bookmark, label: 'Saved', color: 'text-purple-500', href: '/saved' },
  { icon: CalendarDays, label: 'Events', color: 'text-red-500', href: '/events' },
  { icon: Flag, label: 'Pages', color: 'text-orange-500', href: '/pages' },
];

export function LeftSidebar() {
  const user = useAuthStore((s) => s.user)!;
  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-[72px] space-y-1 overflow-y-auto pr-2">
        <Link href={`/u/${user.username}`} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
          <Avatar src={user.profilePicture} name={user.firstName} initials={initials(user)} size={36} />
          <span className="font-medium">{fullName(user)}</span>
        </Link>
        {ITEMS.map((it) => (
          <Link key={it.label} href={it.href} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
            <it.icon className={`size-6 ${it.color}`} />
            <span className="font-medium">{it.label}</span>
          </Link>
        ))}
        {user.role !== 'USER' && (
          <Link href="/admin" className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
            <ShieldCheck className="size-6 text-red-500" />
            <span className="font-medium">Admin Panel</span>
          </Link>
        )}
        <Link href="/menu" className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent">
          <span className="flex size-6 items-center justify-center rounded-full bg-secondary">
            <ChevronDown className="size-4" />
          </span>
          <span className="font-medium">See more</span>
        </Link>
        <p className="px-2 pt-3 text-xs text-muted-foreground">
          Orbit · A learning project · © {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
}
