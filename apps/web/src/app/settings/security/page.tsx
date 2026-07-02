'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { AuthGuard } from '@/components/auth-guard';
import { useAuthStore } from '@/stores/auth-store';
import {
  useDisable2FA,
  useEnable2FA,
  useRevokeSession,
  useSessions,
  useSetup2FA,
} from '@/hooks/use-security';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

function TwoFactorCard() {
  const user = useAuthStore((s) => s.user)!;
  const setup = useSetup2FA();
  const enable = useEnable2FA();
  const disable = useDisable2FA();

  const [qr, setQr] = React.useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);

  const startSetup = async () => {
    try {
      const res = await setup.mutateAsync();
      setQr({ qrDataUrl: res.qrDataUrl, secret: res.secret });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not start 2FA setup');
    }
  };

  const confirmEnable = async () => {
    try {
      const res = await enable.mutateAsync(code);
      setBackupCodes(res.backupCodes);
      setQr(null);
      setCode('');
      toast.success('Two-factor authentication enabled');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Invalid code');
    }
  };

  const confirmDisable = async () => {
    try {
      await disable.mutateAsync(password);
      setPassword('');
      toast.success('Two-factor authentication disabled');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not disable 2FA');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Two-factor authentication</CardTitle>
        <CardDescription>
          Add a second step at login using an authenticator app (TOTP).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {backupCodes && (
          <Alert variant="success">
            <AlertDescription>
              <p className="mb-2 font-semibold">Save your backup codes — they won&apos;t be shown again:</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {user.twoFactorEnabled ? (
          <div className="space-y-3">
            <Alert variant="success">
              <AlertDescription>Two-factor authentication is currently enabled.</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="disable-pw">Confirm your password to disable</Label>
              <Input
                id="disable-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button variant="destructive" onClick={confirmDisable} disabled={disable.isPending || !password}>
              {disable.isPending && <Loader2 className="animate-spin" />}
              Disable 2FA
            </Button>
          </div>
        ) : qr ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code.
            </p>
            <Image src={qr.qrDataUrl} alt="2FA QR code" width={180} height={180} className="rounded-md border" unoptimized />
            <p className="break-all text-xs text-muted-foreground">
              Or enter this secret manually: <span className="font-mono">{qr.secret}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="enable-code">Verification code</Label>
              <Input
                id="enable-code"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button onClick={confirmEnable} disabled={enable.isPending || code.length < 6}>
              {enable.isPending && <Loader2 className="animate-spin" />}
              Verify & enable
            </Button>
          </div>
        ) : (
          <Button onClick={startSetup} disabled={setup.isPending}>
            {setup.isPending && <Loader2 className="animate-spin" />}
            Enable 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const { data, isLoading } = useSessions();
  const revoke = useRevokeSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Active sessions</CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Loader2 className="animate-spin text-primary" />}
        {data?.sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <Monitor className="size-5 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">
                  {s.deviceName ?? s.userAgent?.slice(0, 40) ?? 'Unknown device'}
                  {s.current && <span className="ml-2 text-xs text-primary">(this device)</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.ip ?? 'unknown ip'} · last active {new Date(s.lastActiveAt).toLocaleString()}
                </div>
              </div>
            </div>
            {!s.current && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revoke.mutate(s.id)}
                disabled={revoke.isPending}
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SecuritySettingsPage() {
  return (
    <AuthGuard>
      <div className="container max-w-2xl space-y-4 py-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Security</h1>
        <TwoFactorCard />
        <SessionsCard />
      </div>
    </AuthGuard>
  );
}
