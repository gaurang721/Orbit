'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';

/** Round button that toggles and persists the dark/light theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = React.useState(true);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light' : 'Switch to dark'}
      aria-label="Toggle theme"
      className={
        className ??
        'flex size-10 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent active:scale-90'
      }
    >
      <span className="relative block size-5">
        <Sun
          className={`absolute inset-0 size-5 transition-all duration-300 ${dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
        />
        <Moon
          className={`absolute inset-0 size-5 transition-all duration-300 ${dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`}
        />
      </span>
    </button>
  );
}
