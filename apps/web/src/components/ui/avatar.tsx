import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  initials: string;
  size?: number;
  className?: string;
}

/** Circular avatar with image, falling back to colored initials. */
export function Avatar({ src, name, initials, size = 40, className }: AvatarProps) {
  const dimension = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        style={dimension}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }
  return (
    <div
      style={dimension}
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/15 font-semibold text-primary',
        className,
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
