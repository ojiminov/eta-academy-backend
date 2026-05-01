import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export class TeachersController {
  /**
   * GET /teachers  (admin)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, page = '1', limit = '20' } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
      const skip     = (pageNum - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (search) {
        where.user = {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
            { email:     { contains: search, mode: 'insensitive' } },
          ],
        };
      }

      const [teachers, total] = await Promise.all([
        prisma.teacher.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, status: true } },
            _count: { select: { groups: true } },
          },
        }),
        prisma.teacher.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          teachers,
          pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /teachers/me  (teacher)
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user!.userId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } },
          groups: {
            where: { status: 'active' },
            include: {
              subject: true,
              schedules: true,
              _count: { select: { students: { where: { isActive: true } } } },
            },
          },
        },
      });

      if (!teacher) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Teacher profile not found.' } });
        return;
      }

      res.status(200).json({ success: true, data: { teacher } });
    } catch (err) { next(err); }
  }

  /**
   * GET /teachers/:id  (admin, self)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teacher = await prisma.teacher.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, status: true } },
          groups: {
            include: {
              subject: true,
              schedules: true,
              _count: { select: { students: { where: { isActive: true } } } },
            },
          },
        },
      });

      if (!teacher) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Teacher not found.' } });
        return;
      }

      res.status(200).json({ success: true, data: { teacher } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /teachers/:id  (admin, self)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bio, subjects, qualifications, salary, salaryCurrency, isVerified } = req.body as {
        bio?: string; subjects?: string[]; qualifications?: string[];
        salary?: number; salaryCurrency?: string; isVerified?: boolean;
      };

      // Teachers cannot change their own salary or verification status
      if (req.user!.role === 'teacher') {
        if (salary !== undefined || isVerified !== undefined || salaryCurrency !== undefined) {
          res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify salary or verification status.' } });
          return;
        }
      }

      const teacher = await prisma.teacher.update({
        where: { id: req.params.id },
        data: {
          ...(bio           !== undefined && { bio }),
          ...(subjects      !== undefined && { subjects }),
          ...(qualifications !== undefined && { qualifications }),
          ...(salary        !== undefined && { salary }),
          ...(salaryCurrency && { salaryCurrency }),
          ...(isVerified    !== undefined && { isVerified }),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.status(200).json({ success: true, data: { teacher } });
    } catch (err) { next(err); }
  }

  /**
   * GET /teachers/:id/schedule  (admin, self)
   * Returns upcoming class sessions for a teacher.
   */
  async getSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query as Record<string, string>;

      const sessions = await prisma.classSession.findMany({
        where: {
          teacherId: req.params.id,
          date: {
            gte: from ? new Date(from) : new Date(),
            ...(to && { lte: new Date(to) }),
          },
        },
        include: {
          group: {
            include: {
              subject: true,
              schedules: true,
            },
          },
          attendance: { select: { status: true } },
        },
        orderBy: { date: 'asc' },
      });

      res.status(200).json({ success: true, data: { sessions } });
    } catch (err) { next(err); }
  }
}

export const teachersController = new TeachersController();
