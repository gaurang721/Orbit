'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { passwordSchema } from '@fbclone/types';
import { z } from 'zod';
import { ApiClientError } from '@/lib/api-client';
import { useResetPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const formSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type FormValues = z.infer<typeof formSchema>;

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const reset = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>This password reset link is missing or malformed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reset.mutateAsync({ token, password: values.password });
      toast.success('Password updated. Please log in.');
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Reset failed');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Make it strong and unique.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
            {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={reset.isPending}>
            {reset.isPending && <Loader2 className="animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<Loader2 className="mx-auto size-8 animate-spin text-primary" />}>
      <ResetForm />
    </React.Suspense>
  );
}
