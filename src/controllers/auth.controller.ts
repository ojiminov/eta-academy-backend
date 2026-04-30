import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Role, UserStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function omitPassword(user: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, verifyToken, resetToken, resetTokenExpiresAt, ...safe } = user;
  return safe;
}

export class AuthController {
  /**
   * POST /auth/register
   * Creates a new user account and sends a verification email.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, lastName, email, password, role, timezone } = req.body as {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        role?: string;
        timezone?: string;
      };

      // Assign role — only allow student or teacher at self-registration
      const assignedRole: Role =
        role === 'teacher' ? Role.teacher : Role.student;

      const passwordHash = await hashPassword(password);
      const verifyToken = generateToken();
      const verifyTokenHash = hashToken(verifyToken);

      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email: email.toLowerCase().trim(),
          passwordHash,
          role: assignedRole,
          status: UserStatus.pending_verification,
          emailVerified: false,
          verifyToken: verifyTokenHash,
          timezone: timezone ?? 'UTC',
        },
      });

      // Create the profile record based on role
      if (assignedRole === Role.student) {
        await prisma.student.create({ data: { userId: user.id } });
      } else if (assignedRole === Role.teacher) {
        await prisma.teacher.create({ data: { userId: user.id, specializations: [], qualifications: [] } });
      }

      // Send verification email (non-blocking on failure)
      try {
        await sendVerificationEmail(user.email, user.firstName, verifyToken);
      } catch (emailErr) {
        console.error('[register] Failed to send verification email:', emailErr);
      }

      res.status(201).json({
        success: true,
        message: 'Account created. Please check your email to verify your account.',
        data: {
          user: omitPassword(user as unknown as Record<string, unknown>),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/login
   * Authenticates a user and issues access + refresh tokens.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: { student: true, teacher: true },
      });

      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        });
        return;
      }

      const passwordMatch = await comparePassword(password, user.passwordHash);
      if (!passwordMatch) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        });
        return;
      }

      if (user.status === UserStatus.suspended) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Please contact support.' },
        });
        return;
      }

      if (user.status === UserStatus.deleted) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_DELETED', message: 'This account no longer exists.' },
        });
        return;
      }

      if (user.status === UserStatus.pending_verification) {
        res.status(403).json({
          success: false,
          error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address before logging in.' },
        });
        return;
      }

      // Generate tokens
      const accessToken = generateAccessToken({ userId: user.id, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user.id });
      const refreshTokenHash = hashToken(refreshToken);

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshTokenHash,
          expiresAt: refreshExpiresAt,
        },
      });

      // Update lastLoginAt
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const { passwordHash, verifyToken, resetToken, resetTokenExpiresAt, ...safeUser } = user;
      void passwordHash; void verifyToken; void resetToken; void resetTokenExpiresAt;

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: safeUser,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/refresh
   * Issues a new access + refresh token pair (token rotation).
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };

      // Verify JWT signature + expiry first
      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired.' },
        });
        return;
      }

      const tokenHash = hashToken(refreshToken);
      const storedToken = await prisma.refreshToken.findFirst({
        where: { tokenHash, revoked: false },
      });

      if (!storedToken) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token not found or already revoked.' },
        });
        return;
      }

      if (new Date() > storedToken.expiresAt) {
        res.status(401).json({
          success: false,
          error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh token has expired. Please log in again.' },
        });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || user.status !== UserStatus.active) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User account is not active.' },
        });
        return;
      }

      // Revoke old token
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      });

      // Issue new tokens
      const newAccessToken = generateAccessToken({ userId: user.id, role: user.role });
      const newRefreshToken = generateRefreshToken({ userId: user.id });
      const newRefreshTokenHash = hashToken(newRefreshToken);

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newRefreshTokenHash,
          expiresAt: refreshExpiresAt,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/logout
   * Revokes the provided refresh token.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };

      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await prisma.refreshToken.updateMany({
          where: { tokenHash, revoked: false },
          data: { revoked: true },
        });
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /auth/verify-email?token=
   * Verifies a user's email address.
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query as { token?: string };

      if (!token) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Verification token is required.' },
        });
        return;
      }

      const tokenHash = hashToken(token);
      const user = await prisma.user.findFirst({ where: { verifyToken: tokenHash } });

      if (!user) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Verification token is invalid or has already been used.' },
        });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verifyToken: null,
          status: UserStatus.active,
        },
      });

      // Send welcome email
      try {
        await sendWelcomeEmail(user.email, user.firstName);
      } catch (emailErr) {
        console.error('[verifyEmail] Failed to send welcome email:', emailErr);
      }

      res.status(200).json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/forgot-password
   * Sends a password-reset email (always returns the same response).
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body as { email: string };

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

      if (user && user.status === UserStatus.active) {
        const resetToken = generateToken();
        const resetTokenHash = hashToken(resetToken);
        const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
          where: { id: user.id },
          data: { resetToken: resetTokenHash, resetTokenExpiresAt },
        });

        try {
          await sendPasswordResetEmail(user.email, user.firstName, resetToken);
        } catch (emailErr) {
          console.error('[forgotPassword] Failed to send reset email:', emailErr);
        }
      }

      // Always respond the same way regardless of whether the user exists
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/reset-password
   * Resets a user's password using a valid reset token.
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };

      const tokenHash = hashToken(token);
      const user = await prisma.user.findFirst({
        where: {
          resetToken: tokenHash,
          resetTokenExpiresAt: { gt: new Date() },
        },
      });

      if (!user) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Password reset token is invalid or has expired.' },
        });
        return;
      }

      const passwordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });

      // Revoke all existing refresh tokens
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revoked: true },
      });

      res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /auth/me
   * Returns the current authenticated user with their profile.
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          student: true,
          teacher: true,
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found.' },
        });
        return;
      }

      const { passwordHash, verifyToken, resetToken, resetTokenExpiresAt, ...safeUser } = user;
      void passwordHash; void verifyToken; void resetToken; void resetTokenExpiresAt;

      res.status(200).json({
        success: true,
        data: { user: safeUser },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
