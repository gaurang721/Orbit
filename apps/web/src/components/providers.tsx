'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { api } from '@/lib/api-client';
import { getQueryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { useRealtime } from '@/hooks/use-realtime';
import { useCallSignaling } from '@/hooks/use-call';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CallOverlay } from '@/components/call/call-overlay';
import { LiveLocationBanner } from '@/components/chat/live-location-banner';

/** Re-hydrate the session once on mount via the httpOnly refresh cookie. */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const setStatus = useAuthStore((s) => s.setStatus);
  useRealtime();
  useCallSignaling();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await api.refresh();
      if (!cancelled && !ok) setStatus('unauthenticated');
    })();
    return () => {
      cancelled = true;
    };
  }, [setStatus]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>{children}</AuthInitializer>
      <ConfirmDialog />
      <CallOverlay />
      <LiveLocationBanner />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
