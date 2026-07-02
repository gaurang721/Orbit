'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clapperboard,
  Gamepad2,
  Grid3x3,
  Home,
  LogOut,
  MessageCircle,
  Phone,
  Settings,
  Store,
  User,
  Users,
} from 'lucide-react';
import { useLogout } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/avatar';
import { OrbitLogo } from '@/components/ui/logo';
import { NavSearch } from '@/components/layout/nav-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationsBell } from '@/components/layout/notifications-bell';
import { cn, fullName, initials } from '@/lib/utils';

const NAV = [
  { icon: Home, label: 'Home', active: true, href: '/' },
  { icon: Clapperboard, label: 'Video', active: false, href: '/watch' },
  { icon: Store, label: 'Marketplace', active: false, href: '/marketplace' },
  { icon: Users, label: 'Groups', active: false, href: '/groups' },
  { icon: Gamepad2, label: 'Gaming', active: false, href: '/gaming' },
] as const;

export function TopNav() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const onLogout = async () => {
    await logout.mutateAsync();
    router.replace('/login');
  };

  return (
    <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b px-4">
      {/* left: logo + search */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-400 text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
          aria-label="Orbit home"
        >
          <OrbitLogo className="size-6" />
        </Link>
        <NavSearch />
      </div>

      {/* center: primary nav */}
      <nav className="hidden items-center gap-1 md:flex">
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={item.label}
            className={cn(
              'relative flex h-12 w-20 items-center justify-center rounded-lg hover:bg-accent',
              item.active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-6" />
            {item.active && <span className="absolute bottom-0 h-[3px] w-full rounded-full bg-primary" />}
          </Link>
        ))}
      </nav>

      {/* right: actions + avatar */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link href="/menu" title="Menu" className="flex size-10 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent active:scale-90">
          <Grid3x3 className="size-5" />
        </Link>
        <Link
          href="/calls"
          title="Calls"
          className="flex size-10 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent active:scale-90"
        >
          <Phone className="size-5" />
        </Link>
        <Link
          href="/messages"
          title="Messenger"
          className="flex size-10 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent active:scale-90"
        >
          <MessageCircle className="size-5" />
        </Link>
        <NotificationsBell />
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} title={fullName(user)}>
            <Avatar src={user.profilePicture} name={user.firstName} initials={initials(user)} size={40} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-20 w-64 origin-top-right animate-scale-in rounded-xl border bg-card p-2 shadow-2xl">
                <div className="mb-2 flex items-center gap-3 rounded-lg border p-3">
                  <Avatar src={user.profilePicture} name={user.firstName} initials={initials(user)} size={40} />
                  <div className="text-sm font-semibold">{fullName(user)}</div>
                </div>
                <Link
                  href={`/u/${user.username}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                >
                  <User className="size-5" /> View profile
                </Link>
                <Link
                  href="/settings/security"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                >
                  <Settings className="size-5" /> Settings &amp; privacy
                </Link>
                <button
                  onClick={onLogout}
                  disabled={logout.isPending}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                >
                  <LogOut className="size-5" /> Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
