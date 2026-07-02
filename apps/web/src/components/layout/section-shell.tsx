'use client';

import * as React from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { TopNav } from '@/components/layout/top-nav';

/** Standard page chrome (auth gate + top nav + centered container) for sections. */
export function SectionShell({
  title,
  action,
  children,
  max = 'max-w-4xl',
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  max?: string;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className={`container ${max} space-y-5 py-6`}>
          {(title || action) && (
            <div className="flex items-center justify-between">
              {title && <h1 className="text-2xl font-bold">{title}</h1>}
              {action}
            </div>
          )}
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
