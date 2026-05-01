import { Request, Response, NextFunction } from 'express';
import { UserStatus, Role } from '@prisma/client';
import prisma from '../lib/prisma';

// ─── helpers ─────────────────────────────────────────────────────────────────
function safeUser(user: Record<string, unknown>) {
  const { passwordHash, verifyToken, resetToken, resetTokenExpiresAt, ...safe } = user;
  void passwordHash; void verifyToken; void resetToken; void resetTokenExpiresAt;
  return safe;
}

export class UsersController {
  /**
   * GET /users  (admin)
   * List all users with optional role/status filters and pagination.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, status, search, page = '1', limit = '20' } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
      const skip     = (pageNum - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (role)   where.role   = role as Role;
      if (status) where.status = status as UserStatus;
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
          { email:     { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: { student: true, teacher: true },
        }),
        prisma.user.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          users: users.map(u => safeUser(u as unknown as Record<string, unknown>)),
          pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /users/:id  (admin)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: { student: true, teacher: true },
      });
      if (!user) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
        return;
      }
      res.status(200).json({ success: true, data: { user: safeUser(user as unknown as Record<string, unknown>) } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /users/:id  (admin)
   * Update role / status / basic profile info.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, lastName, phone, avatarUrl, role, status, timezone, locale } = req.body as {
        firstName?: string; lastName?: string; phone?: string; avatarUrl?: string;
        role?: Role; status?: UserStatus; timezone?: string; locale?: string;
      };

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          ...(firstName  && { firstName }),
          ...(lastName   && { lastName }),
          ...(phone      !== undefined && { phone }),
          ...(avatarUrl  !== undefined && { avatarUrl }),
          ...(role       && { role }),
          ...(status     && { status }),
          ...(timezone   && { timezone }),
          ...(locale     && { locale }),
        },
        include: { student: true, teacher: true },
      });

      res.status(200).json({ success: true, data: { user: safeUser(user as unknown as Record<string, unknown>) } });
    } catch (err) { next(err); }
  }

  /**
   * DELETE /users/:id  (admin) — soft delete
   */
  async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: req.params.id },
        data: { status: UserStatus.deleted },
      });
      res.status(204).send();
    } catch (err) { next(err); }
  }

  /**
   * GET /users/stats  (admin) — quick KPI counts
   */
  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [totalStudents, totalTeachers, activeUsers, pendingUsers] = await Promise.all([
        prisma.user.count({ where: { role: 'student' } }),
        prisma.user.count({ where: { role: 'teacher' } }),
        prisma.user.count({ where: { status: 'active' } }),
        prisma.user.count({ where: { status: 'pending_verification' } }),
      ]);

      res.status(200).json({
        success: true,
        data: { totalStudents, totalTeachers, activeUsers, pendingUsers },
      });
    } catch (err) { next(err); }
  }
}

export const usersController = new UsersController();
