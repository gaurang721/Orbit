'use client';

import * as React from 'react';
import { Loader2, Mic, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function VoiceRecorder({
  onSend,
  onRecordingChange,
  sending,
}: {
  onSend: (blob: Blob, duration: number) => void;
  onRecordingChange: (recording: boolean) => void;
  sending: boolean;
}) {
  const [recording, setRecording] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef(0);
  const cancelledRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const cleanup = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  };

  React.useEffect(() => cleanup, []);

  const start = async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Recording needs HTTPS or localhost — and a browser that supports it (Chrome/Edge/Firefox).');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('This browser does not support MediaRecorder.');
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      cancelledRef.current = false;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        cleanup();
        setRecording(false);
        onRecordingChange(false);
        setElapsed(0);
        if (!cancelledRef.current && blob.size > 0) onSend(blob, duration);
      };

      rec.start();
      startedAtRef.current = Date.now();
      setStarting(false);
      setRecording(true);
      onRecordingChange(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      setStarting(false);
      cleanup();
      const name = (err as { name?: string } | null)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError')
        setError('Microphone blocked. Click the 🔒/icon in the address bar → allow Microphone, then try again.');
      else if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
        setError('No microphone found on this device.');
      else if (name === 'NotReadableError' || name === 'TrackStartError')
        setError('Microphone is in use by another app. Close it and retry.');
      else setError(`Could not start recording${name ? ` (${name})` : ''}.`);
      // Handled + surfaced in-app; warn (not error) so the Next dev overlay
      // doesn't pop for an expected permission/device condition.
      // eslint-disable-next-line no-console
      console.warn('[voice] getUserMedia/MediaRecorder failed:', name || err);
    }
  };

  const stopAndSend = () => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
  };

  const cancel = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  };

  if (!recording) {
    return (
      <div className="relative flex shrink-0 items-center">
        {error && (
          <div
            role="alert"
            className="absolute bottom-full right-0 mb-2 w-max max-w-[260px] rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-medium leading-snug text-destructive-foreground shadow-lg"
          >
            {error}
          </div>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-full text-muted-foreground hover:text-primary"
          onClick={start}
          disabled={sending || starting}
          aria-label="Record a voice message"
          title={error ?? 'Record a voice message'}
        >
          {sending || starting ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-5" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 rounded-full text-destructive hover:bg-destructive/10"
        onClick={cancel}
        aria-label="Cancel recording"
      >
        <Trash2 className="size-4" />
      </Button>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
        Recording…
      </span>
      <span className="ml-auto text-sm tabular-nums text-foreground">{fmt(elapsed)}</span>
      <Button
        type="button"
        size="icon"
        className="size-8 shrink-0 rounded-full"
        onClick={stopAndSend}
        aria-label="Send voice message"
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
