import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { env } from '../config/env.js';

// Allow a small clock-drift window (±1 step).
authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(accountName: string, secret: string): string {
  return authenticator.keyuri(accountName, env.TOTP_ISSUER, secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

export async function otpAuthUrlToDataUrl(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl);
}
