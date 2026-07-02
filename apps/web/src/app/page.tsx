'use client';

import { MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth-guard';
import { TopNav } from '@/components/layout/top-nav';
import { LeftSidebar } from '@/components/layout/left-sidebar';
import { RightSidebar } from '@/components/layout/right-sidebar';
import { StoriesRow } from '@/components/layout/stories-row';
import { Feed } from '@/components/feed/feed';
import { useResendVerification } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

function Shell() {
  const user = useAuthStore((s) => s.user)!;
  const resend = useResendVerification();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="mx-auto flex max-w-[1600px] justify-center gap-4 px-4 py-4">
        <LeftSidebar />

        {/* center feed column */}
        <main className="w-full max-w-[600px] space-y-4">
          {!user.emailVerified && (
            <Alert variant="destructive">
              <MailWarning className="size-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>Verify your email ({user.email}) to secure your account.</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resend.mutate(user.email);
                    toast.success('Verification email sent (see API logs in dev).');
                  }}
                >
                  Resend
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <StoriesRow />
          <Feed />
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <Shell />
    </AuthGuard>
  );
}
