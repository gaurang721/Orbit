'use client';

import * as React from 'react';
import { useConfirmStore } from '@/stores/confirm-store';
import { Button } from './button';

/** Global confirmation modal. Mount once near the app root. */
export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const settle = useConfirmStore((s) => s.settle);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, settle]);

  if (!open) return null;

  const {
    title = 'Are you sure?',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive,
  } = options;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={() => settle(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm animate-scale-in rounded-xl border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        {message && <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => settle(false)}>
            {cancelText}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={() => settle(true)} autoFocus>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
