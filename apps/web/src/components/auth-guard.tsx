'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

/** Gate a subtree behind authentication. Redirects unauthenticated users to /login. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  return <>{children}</>;
}

/** Inverse guard: redirect already-authenticated users away from auth pages. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  React.useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  return <>{children}</>;
}
