import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null; // dev mode: log instead of send
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: MailOptions): Promise<void> {
  const tx = getTransporter();
  if (!tx) {
    // Dev fallback: surface the email (and any links) in the API logs.
    logger.info({ to, subject, preview: text ?? html.replace(/<[^>]+>/g, ' ').slice(0, 500) }, '📧 [dev] email (not sent — configure SMTP_HOST to deliver)');
    return;
  }
  await tx.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
  logger.info({ to, subject }, '📧 email sent');
}

// ----- Templates -------------------------------------------------------------

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:Helvetica,Arial,sans-serif;background:#f0f2f5;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
    <div style="background:#1877F2;color:#fff;padding:20px 24px;font-size:22px;font-weight:bold">Orbit</div>
    <div style="padding:24px;color:#1c1e21;font-size:15px;line-height:1.5">
      <h2 style="margin-top:0">${title}</h2>${body}
    </div>
    <div style="padding:16px 24px;color:#90949c;font-size:12px">If you didn't request this, you can safely ignore this email.</div>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1877F2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;margin:12px 0">${label}</a>`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${env.WEB_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'Verify your email address',
    text: `Verify your email: ${url}`,
    html: layout(
      'Confirm your email',
      `<p>Welcome to Orbit! Confirm your email address to activate your account.</p>${button(url, 'Verify email')}<p style="color:#90949c;font-size:13px">This link expires in 24 hours.</p>`,
    ),
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${env.WEB_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'Reset your password',
    text: `Reset your password: ${url}`,
    html: layout(
      'Reset your password',
      `<p>We received a request to reset your password.</p>${button(url, 'Reset password')}<p style="color:#90949c;font-size:13px">This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>`,
    ),
  });
}
