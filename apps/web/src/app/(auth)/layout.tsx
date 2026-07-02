import Link from 'next/link';
import { GuestGuard } from '@/components/auth-guard';
import { OrbitWordmark } from '@/components/ui/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
        <Link href="/" className="animate-fade-up" aria-label="Orbit home">
          <OrbitWordmark size={48} />
        </Link>
        <div className="w-full max-w-md animate-scale-in">{children}</div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Orbit · A learning project
        </p>
      </div>
    </GuestGuard>
  );
}
