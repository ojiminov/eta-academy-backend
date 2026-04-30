import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  timezone: z.string().default('UTC'),
  role: z.enum(['student', 'teacher']).optional().default('student'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /auth/register
router.post('/register', validate(registerSchema), (req, res, next) => {
  authController.register(req, res, next);
});

// POST /auth/login
router.post('/login', validate(loginSchema), (req, res, next) => {
  authController.login(req, res, next);
});

// POST /auth/refresh
router.post('/refresh', validate(refreshTokenSchema), (req, res, next) => {
  authController.refreshToken(req, res, next);
});

// POST /auth/logout  (authenticated)
router.post('/logout', authenticate, (req, res, next) => {
  authController.logout(req, res, next);
});

// GET /auth/verify-email?token=
router.get('/verify-email', (req, res, next) => {
  authController.verifyEmail(req, res, next);
});

// POST /auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), (req, res, next) => {
  authController.forgotPassword(req, res, next);
});

// POST /auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), (req, res, next) => {
  authController.resetPassword(req, res, next);
});

// GET /auth/me  (authenticated)
router.get('/me', authenticate, (req, res, next) => {
  authController.getMe(req, res, next);
});

export default router;
