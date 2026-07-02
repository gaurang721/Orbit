'use client';

import * as React from 'react';
import { Check, CheckCheck, CornerUpRight, X } from 'lucide-react';
import type { MessageDTO } from '@fbclone/types';
import { Button } from '@/components/ui/button';
import { fullName } from '@/lib/utils';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

/** Read-only "message info" panel: sender, timestamp, type, forwarded + delivery status. */
export function MessageInfoDialog({
  message,
  otherLastReadAt,
  onClose,
}: {
  message: MessageDTO;
  otherLastReadAt: string | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const seen =
    message.isOwn &&
    otherLastReadAt != null &&
    new Date(otherLastReadAt).getTime() >= new Date(message.createdAt).getTime();

  const typeLabel =
    message.type === 'VOICE'
      ? `Voice note${message.voiceDuration ? ` · ${message.voiceDuration}s` : ''}`
      : message.type === 'TEXT'
        ? 'Text'
        : message.type;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm animate-scale-in rounded-xl border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Message info</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        {message.content && (
          <div className="mb-3 max-h-28 overflow-y-auto rounded-lg bg-muted/50 px-3 py-2 text-sm">
            {message.content}
          </div>
        )}

        <div className="divide-y">
          <Row label="From">
            {fullName(message.sender)}{' '}
            <span className="text-muted-foreground">@{message.sender.username}</span>
          </Row>
          <Row label="Type">{typeLabel}</Row>
          <Row label="Sent">{fmt(message.createdAt)}</Row>
          <Row label="Forwarded">
            {message.forwarded ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <CornerUpRight className="size-3.5" /> Yes
              </span>
            ) : (
              'No'
            )}
          </Row>
          {message.isOwn && (
            <Row label="Status">
              {seen ? (
                <span className="inline-flex items-center gap-1 text-sky-500">
                  <CheckCheck className="size-4" /> Seen
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Check className="size-4" /> Sent
                </span>
              )}
            </Row>
          )}
        </div>
      </div>
    </div>
  );
}
