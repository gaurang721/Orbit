'use client';

import Link from 'next/link';
import {
  Bookmark,
  CalendarDays,
  Clock,
  Flag,
  Gamepad2,
  Store,
  User,
  Users,
  Video,
} from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';

const SHORTCUTS = [
  { icon: Users, label: 'Friends', href: '/friends', color: 'text-blue-500' },
  { icon: Users, label: 'Groups', href: '/groups', color: 'text-sky-500' },
  { icon: Store, label: 'Marketplace', href: '/marketplace', color: 'text-emerald-500' },
  { icon: Video, label: 'Watch', href: '/watch', color: 'text-pink-500' },
  { icon: CalendarDays, label: 'Events', href: '/events', color: 'text-red-500' },
  { icon: Flag, label: 'Pages', href: '/pages', color: 'text-orange-500' },
  { icon: Bookmark, label: 'Saved', href: '/saved', color: 'text-purple-500' },
  { icon: Clock, label: 'Memories', href: '/memories', color: 'text-indigo-500' },
  { icon: Gamepad2, label: 'Gaming', href: '/gaming', color: 'text-violet-500' },
];

function MenuContent() {
  const user = useAuthStore((s) => s.user)!;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Link href={`/u/${user.username}`}>
        <Card className="card-hover flex items-center gap-3 p-4">
          <User className="size-6 text-primary" />
          <span className="font-semibold">Your profile</span>
        </Card>
      </Link>
      {SHORTCUTS.map((s) => (
        <Link key={s.label} href={s.href}>
          <Card className="card-hover flex items-center gap-3 p-4">
            <s.icon className={`size-6 ${s.color}`} />
            <span className="font-semibold">{s.label}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function MenuPage() {
  return (
    <SectionShell title="Menu" max="max-w-3xl">
      <MenuContent />
    </SectionShell>
  );
}
