import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h2 className="text-xl font-semibold text-foreground">This page isn&apos;t available</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The link may be broken, or the page may have been removed.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
