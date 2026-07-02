'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@fbclone/types';
import { useForgotPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await forgot.mutateAsync(values).catch(() => undefined);
    setSent(true); // always show success — don't reveal whether the account exists
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Alert variant="success">
            <CheckCircle2 className="size-4" />
            <AlertDescription>
              If an account exists for that email, a reset link is on its way.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={forgot.isPending}>
              {forgot.isPending && <Loader2 className="animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
