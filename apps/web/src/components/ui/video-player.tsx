'use client';

import * as React from 'react';
import { Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  /** Classes applied to the <video> in its normal (non-fullscreen) state. */
  className?: string;
}

/**
 * Video with the full set of native controls (play/seek, volume, playback
 * speed, picture-in-picture, download) PLUS a guaranteed fullscreen control:
 * a hover button and double-click both toggle fullscreen on the wrapper, with
 * an iOS Safari (`webkitEnterFullscreen`) fallback. In fullscreen the video
 * fills the screen (object-contain) instead of staying capped at its inline
 * max-height.
 */
export function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else if (container?.requestFullscreen) {
      container.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    } else {
      video?.webkitEnterFullscreen?.();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative bg-black',
        isFullscreen && 'flex h-screen w-screen items-center justify-center',
      )}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        onDoubleClick={toggleFullscreen}
        className={cn('w-full bg-black', isFullscreen ? 'h-full max-h-none object-contain' : className)}
      />
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit full screen' : 'Full screen'}
        aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition hover:bg-black/80 focus:opacity-100 group-hover:opacity-100"
      >
        <Maximize className="size-4" />
      </button>
    </div>
  );
}
