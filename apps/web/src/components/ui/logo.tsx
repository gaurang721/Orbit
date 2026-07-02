import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The Orbit mark: a solid core, a tilted orbit ring, and a satellite on the
 * ring. Pure inline SVG using `currentColor`, so it inherits the surrounding
 * text color (e.g. white on the gradient nav badge). Size it via `className`.
 */
export function OrbitLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('size-6', className)}
    >
      <ellipse
        cx="12"
        cy="12"
        rx="9.5"
        ry="3.8"
        transform="rotate(-25 12 12)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" />
      <circle cx="20.6" cy="8" r="1.7" fill="currentColor" />
    </svg>
  );
}

/**
 * Full lockup: the mark inside a gradient badge next to the "Orbit" wordmark.
 * Used on the auth screens. `markOnly` renders just the badge.
 */
export function OrbitWordmark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className="grid place-items-center rounded-2xl bg-gradient-to-br from-primary to-blue-400 text-primary-foreground shadow-lg shadow-primary/30"
        style={{ width: size, height: size }}
      >
        <OrbitLogo className="size-[62%]" />
      </span>
      <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
        Orbit
      </span>
    </span>
  );
}
