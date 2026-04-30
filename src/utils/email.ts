import { Resend } from 'resend';
import { config } from '../config/env';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!config.resend.apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(config.resend.apiKey);
  }
  return resendClient;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;
  const subject = 'Verify your ETA Academy email address';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">Welcome to ETA Academy, ${name}!</h1>
      <p>Thank you for registering. Please verify your email address to activate your account.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Verify Email Address
      </a>
      <p style="margin-top:16px;color:#6b7280;font-size:14px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">This link expires in 24 hours. If you did not create an account, please ignore this email.</p>
    </div>
  `;

  const client = getResendClient();
  if (!client || config.nodeEnv === 'development') {
    console.log('[EMAIL] sendVerificationEmail');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Verify URL: ${verifyUrl}`);
    return;
  }

  await client.emails.send({
    from: config.resend.emailFrom,
    to,
    subject,
    html,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  const subject = 'Reset your ETA Academy password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">Password Reset Request</h1>
      <p>Hi ${name},</p>
      <p>We received a request to reset the password for your ETA Academy account. Click the button below to choose a new password.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Reset Password
      </a>
      <p style="margin-top:16px;color:#6b7280;font-size:14px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">This link expires in 1 hour. If you did not request a password reset, please ignore this email — your password will remain unchanged.</p>
    </div>
  `;

  const client = getResendClient();
  if (!client || config.nodeEnv === 'development') {
    console.log('[EMAIL] sendPasswordResetEmail');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Reset URL: ${resetUrl}`);
    return;
  }

  await client.emails.send({
    from: config.resend.emailFrom,
    to,
    subject,
    html,
  });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const subject = 'Welcome to ETA Academy!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">Welcome aboard, ${name}!</h1>
      <p>Your email has been verified and your ETA Academy account is now active.</p>
      <p>You can now:</p>
      <ul>
        <li>Browse our course library</li>
        <li>Enroll in courses and start learning</li>
        <li>Track your progress and earn certificates</li>
      </ul>
      <a href="${config.frontendUrl}/courses" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Browse Courses
      </a>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">Happy learning! — The ETA Academy Team</p>
    </div>
  `;

  const client = getResendClient();
  if (!client || config.nodeEnv === 'development') {
    console.log('[EMAIL] sendWelcomeEmail');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return;
  }

  await client.emails.send({
    from: config.resend.emailFrom,
    to,
    subject,
    html,
  });
}
