'use client';

import * as React from 'react';
import type { CallSignalIncoming } from '@fbclone/types';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useCallStore } from '@/stores/call-store';

/**
 * Route inbound `call:signal` socket events into the call store. Mounted once,
 * app-wide (alongside useRealtime) so incoming calls ring from any page.
 */
export function useCallSignaling() {
  const token = useAuthStore((s) => s.accessToken);

  React.useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    const onSignal = (signal: CallSignalIncoming) => {
      void useCallStore.getState().handleSignal(signal);
    };
    socket.on('call:signal', onSignal);
    return () => {
      socket.off('call:signal', onSignal);
    };
  }, [token]);
}
