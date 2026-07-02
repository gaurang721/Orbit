'use client';

import { useEffect } from 'react';
import './globals.css';

// global-error replaces the root layout when an error is thrown in it, so it
// must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A critical error occurred. Please try reloading the application.
          </p>
          <button
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
