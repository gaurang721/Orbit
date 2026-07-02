'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileWarning,
  Loader2,
  ShieldCheck,
  Users as UsersIcon,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserDTO, ReportDTO, ReportStatus, Role } from '@fbclone/types';
import { AuthGuard } from '@/components/auth-guard';
import { TopNav } from '@/components/layout/top-nav';
import {
  useAdminReports,
  useAdminStats,
  useAdminUsers,
  useBanUser,
  useResolveReport,
  useSetRole,
} from '@/hooks/use-admin';
import { useAuthStore } from '@/stores/auth-store';
import { confirmDialog } from '@/stores/confirm-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

const ROLE_RANK: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 };

const STATUS_STYLE: Record<ReportStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-500',
  REVIEWING: 'bg-sky-500/15 text-sky-500',
  RESOLVED: 'bg-emerald-500/15 text-emerald-500',
  DISMISSED: 'bg-muted text-muted-foreground',
};

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | undefined; tone?: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn('grid size-10 place-items-center rounded-lg', tone ?? 'bg-primary/15 text-primary')}>{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value ?? '—'}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reports tab
// ---------------------------------------------------------------------------
const REPORT_FILTERS: { label: string; value?: ReportStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Reviewing', value: 'REVIEWING' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Dismissed', value: 'DISMISSED' },
  { label: 'All', value: undefined },
];

function ReportRow({ report }: { report: ReportDTO }) {
  const resolve = useResolveReport();
  const open = report.status === 'PENDING' || report.status === 'REVIEWING';
  const act = (status: 'RESOLVED' | 'DISMISSED') =>
    resolve.mutate(
      { id: report.id, status },
      { onSuccess: () => toast.success(`Report ${status.toLowerCase()}`) },
    );

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar src={report.reporter.profilePicture} name={report.reporter.firstName} initials={initials(report.reporter)} size={36} />
          <div className="text-sm">
            <span className="font-semibold">{fullName(report.reporter)}</span>
            <span className="text-muted-foreground"> reported a {report.targetType.toLowerCase()}</span>
            <div className="text-xs text-muted-foreground">{timeAgo(report.createdAt)}</div>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLE[report.status])}>
          {report.status}
        </span>
      </div>

      <div className="rounded-lg bg-muted/40 p-3 text-sm">
        <div><span className="font-semibold">Reason:</span> {report.reason}</div>
        {report.description && <div className="mt-1 text-muted-foreground">{report.description}</div>}
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {report.targetType}#{report.targetId}
        </div>
      </div>

      {report.resolvedBy && (
        <div className="text-xs text-muted-foreground">
          {report.status.toLowerCase()} by {fullName(report.resolvedBy)}
          {report.resolutionNote ? ` — “${report.resolutionNote}”` : ''}
        </div>
      )}

      {open && (
        <div className="flex gap-2">
          <Button size="sm" disabled={resolve.isPending} onClick={() => act('RESOLVED')}>
            <CheckCircle2 className="size-4" /> Resolve
          </Button>
          <Button size="sm" variant="secondary" disabled={resolve.isPending} onClick={() => act('DISMISSED')}>
            <XCircle className="size-4" /> Dismiss
          </Button>
        </div>
      )}
    </Card>
  );
}

function ReportsTab() {
  const [filter, setFilter] = React.useState<ReportStatus | undefined>('PENDING');
  const reports = useAdminReports(filter);
  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORT_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reports.isLoading && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>}
      {!reports.isLoading && items.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">No reports here. 🎉</Card>
      )}
      <div className="space-y-3">
        {items.map((r) => <ReportRow key={r.id} report={r} />)}
      </div>
      {reports.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => reports.fetchNextPage()} disabled={reports.isFetchingNextPage}>
            {reports.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
const ROLE_STYLE: Record<Role, string> = {
  USER: 'bg-muted text-muted-foreground',
  MODERATOR: 'bg-sky-500/15 text-sky-500',
  ADMIN: 'bg-violet-500/15 text-violet-500',
  SUPER_ADMIN: 'bg-amber-500/15 text-amber-500',
};

function UserRow({ user, canBan, canSetRole }: { user: AdminUserDTO; canBan: boolean; canSetRole: boolean }) {
  const ban = useBanUser();
  const setRole = useSetRole();

  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <Avatar src={user.profilePicture} name={user.firstName} initials={initials(user)} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{fullName(user)}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', ROLE_STYLE[user.role])}>{user.role}</span>
          {user.isBanned && <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">BANNED</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">@{user.username} · {user.email}</div>
      </div>

      {canSetRole && (
        <select
          value={user.role}
          onChange={async (e) => {
            const role = e.target.value as Role;
            const ok = await confirmDialog({
              title: 'Change role?',
              message: `Set ${fullName(user)}'s role to ${role}?`,
              confirmText: 'Change role',
              destructive: true,
            });
            if (!ok) return;
            setRole.mutate(
              { id: user.id, role },
              { onSuccess: () => toast.success(`Role updated to ${role}`), onError: (err) => toast.error((err as Error).message) },
            );
          }}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          {(['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as Role[]).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}

      {canBan && (
        user.isBanned ? (
          <Button size="sm" variant="secondary" disabled={ban.isPending}
            onClick={() => ban.mutate({ id: user.id, banned: false }, { onSuccess: () => toast.success('User unbanned') })}>
            <ShieldCheck className="size-4" /> Unban
          </Button>
        ) : (
          <Button size="sm" variant="destructive" disabled={ban.isPending}
            onClick={async () => {
              const ok = await confirmDialog({
                title: `Ban ${fullName(user)}?`,
                message: 'They will be signed out and blocked from logging in until unbanned.',
                confirmText: 'Ban user',
                destructive: true,
              });
              if (!ok) return;
              ban.mutate({ id: user.id, banned: true }, {
                onSuccess: () => toast.success('User banned'),
                onError: (err) => toast.error((err as Error).message),
              });
            }}>
            <Ban className="size-4" /> Ban
          </Button>
        )
      )}
    </Card>
  );
}

function UsersTab({ me }: { me: { role: Role } }) {
  const [term, setTerm] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<'all' | 'banned' | 'active'>('all');
  const users = useAdminUsers(query, status);
  const items = users.data?.pages.flatMap((p) => p.items) ?? [];
  const canBan = ROLE_RANK[me.role] >= ROLE_RANK.ADMIN;
  const canSetRole = me.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setQuery(term.trim()); }} className="flex flex-1 gap-2">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name, username or email…" />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'banned' | 'active')}
          className="rounded-md border bg-background px-2 py-2 text-sm">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {users.isLoading && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>}
      {!users.isLoading && items.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">No users found.</Card>
      )}
      <div className="space-y-2">
        {items.map((u) => <UserRow key={u.id} user={u} canBan={canBan} canSetRole={canSetRole} />)}
      </div>
      {users.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => users.fetchNextPage()} disabled={users.isFetchingNextPage}>
            {users.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
function AdminShell() {
  const me = useAuthStore((s) => s.user)!;
  const [tab, setTab] = React.useState<'reports' | 'users'>('reports');
  const stats = useAdminStats();

  if (ROLE_RANK[me.role] < ROLE_RANK.MODERATOR) {
    return (
      <main className="container max-w-md py-20 text-center">
        <AlertTriangle className="mx-auto size-10 text-amber-500" />
        <h1 className="mt-3 text-xl font-bold">Restricted area</h1>
        <p className="mt-1 text-muted-foreground">You need a moderator or admin role to view the admin panel.</p>
      </main>
    );
  }

  return (
    <main className="container max-w-4xl space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-bold">Admin &amp; Moderation</h1>
        <p className="text-sm text-muted-foreground">Signed in as {fullName(me)} · {me.role}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<UsersIcon className="size-5" />} label="Total users" value={stats.data?.totalUsers} />
        <StatCard icon={<Ban className="size-5" />} label="Banned" value={stats.data?.bannedUsers} tone="bg-destructive/15 text-destructive" />
        <StatCard icon={<FileWarning className="size-5" />} label="Pending reports" value={stats.data?.pendingReports} tone="bg-amber-500/15 text-amber-500" />
        <StatCard icon={<CheckCircle2 className="size-5" />} label="Total posts" value={stats.data?.totalPosts} tone="bg-emerald-500/15 text-emerald-500" />
      </div>

      <div className="flex gap-2 border-b">
        {(['reports', 'users'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-semibold capitalize',
              tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'reports' ? <ReportsTab /> : <UsersTab me={me} />}
    </main>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <TopNav />
        <AdminShell />
      </div>
    </AuthGuard>
  );
}
