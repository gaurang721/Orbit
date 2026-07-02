'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { ApiClientError } from '@/lib/api-client';
import { useVerifyEmail } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function VerifyEmailInner() {
  const token = useSearchParams().get('token') ?? '';
  const verify = useVerifyEmail();
  const [state, setState] = React.useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = React.useState('');
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState('error');
      setMessage('Verification token is missing.');
      return;
    }
    verify
      .mutateAsync(token)
      .then(() => setState('success'))
      .catch((err) => {
        setState('error');
        setMessage(err instanceof ApiClientError ? err.message : 'Verification failed.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Card className="text-center">
      <CardHeader className="items-center">
        {state === 'verifying' && <Loader2 className="size-10 animate-spin text-primary" />}
        {state === 'success' && <CheckCircle2 className="size-10 text-green-600" />}
        {state === 'error' && <XCircle className="size-10 text-destructive" />}
        <CardTitle className="mt-2">
          {state === 'verifying' && 'Verifying your email…'}
          {state === 'success' && 'Email verified!'}
          {state === 'error' && 'Verification failed'}
        </CardTitle>
        <CardDescription>
          {state === 'success' && 'Your account is now fully activated.'}
          {state === 'error' && message}
        </CardDescription>
      </CardHeader>
      {state !== 'verifying' && (
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/">Continue</Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <React.Suspense fallback={<Loader2 className="mx-auto size-8 animate-spin text-primary" />}>
          <VerifyEmailInner />
        </React.Suspense>
      </div>
    </div>
  );
}
