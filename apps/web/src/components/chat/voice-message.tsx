'use client';

import * as React from 'react';
import { AlertCircle, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// A fixed pseudo-waveform — purely decorative, seeded so it looks stable.
const BARS = [5, 9, 14, 11, 18, 8, 22, 13, 7, 16, 24, 12, 6, 19, 10, 15, 21, 9, 13, 7, 17, 11, 23, 8];

export function VoiceMessage({
  url,
  duration,
  own,
}: {
  url: string;
  duration: number | null;
  own: boolean;
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [cur, setCur] = React.useState(0);
  const [total, setToTotal] = React.useState(duration && duration > 0 ? duration : 0);
  const [failed, setFailed] = React.useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // play() rejects (NotSupportedError / NotAllowedError) on browsers that
      // can't decode the format — catch it so it doesn't crash the app.
      a.play().catch(() => setFailed(true));
    } else {
      a.pause();
    }
  };

  const progress = total > 0 ? Math.min(1, cur / total) : 0;
  const litBars = Math.round(progress * BARS.length);

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        title={failed ? "This audio can't be played in your browser" : undefined}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50',
          own ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-background/60 hover:bg-background',
        )}
      >
        {failed ? <AlertCircle className="size-4" /> : playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>

      <div className="flex items-center gap-[3px]" aria-hidden>
        {BARS.map((h, i) => (
          <span
            key={i}
            className={cn(
              'w-[3px] rounded-full transition-colors',
              i < litBars ? (own ? 'bg-primary-foreground' : 'bg-primary') : own ? 'bg-primary-foreground/35' : 'bg-foreground/25',
            )}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      <span className={cn('w-9 shrink-0 text-right text-xs tabular-nums', own ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
        {fmt(playing || cur > 0 ? total - cur : total)}
      </span>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onError={() => setFailed(true)}
        onPlay={() => { setPlaying(true); setFailed(false); }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setToTotal(d);
        }}
        onEnded={(e) => {
          setPlaying(false);
          setCur(0);
          e.currentTarget.currentTime = 0;
        }}
      />
    </div>
  );
}
