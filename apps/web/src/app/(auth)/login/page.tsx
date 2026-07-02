'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loginSchema, type LoginInput } from '@fbclone/types';
import { ApiClientError } from '@/lib/api-client';
import { isChallenge, useLogin, useLoginTwoFactor } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const twoFactor = useLoginTwoFactor();
  const [challengeToken, setChallengeToken] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await login.mutateAsync(values);
      if (isChallenge(res)) {
        setChallengeToken(res.challengeToken);
        toast.message('Enter the code from your authenticator app');
      } else {
        router.replace('/');
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Login failed');
    }
  });

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    try {
      await twoFactor.mutateAsync({ challengeToken, code });
      router.replace('/');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Invalid code');
    }
  };

  if (challengeToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>Enter the 6-digit code or a backup code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onVerify} className="space-y-4">
            <Input
              autoFocus
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={twoFactor.isPending}>
              {twoFactor.isPending && <Loader2 className="animate-spin" />}
              Verify
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setChallengeToken(null)}>
              Back
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or username</Label>
            <Input id="identifier" autoComplete="username" {...register('identifier')} />
            {errors.identifier && <p className="text-sm text-destructive">{errors.identifier.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" {...register('rememberMe')} />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>
            {login.isPending && <Loader2 className="animate-spin" />}
            Log in
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
