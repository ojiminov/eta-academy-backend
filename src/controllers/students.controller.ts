import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export class StudentsController {
  /**
   * GET /students  (admin, teacher)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, groupId, page = '1', limit = '20' } = req.query as Record<string, string>;

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

      if (groupId) {
        where.enrollments = { some: { groupId, isActive: true } };
      }

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, status: true } },
            enrollments: {
              where: { isActive: true },
              include: { group: { include: { subject: true } } },
            },
          },
        }),
        prisma.student.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          students,
          pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /students/:id  (admin, teacher, self)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, status: true, createdAt: true } },
          enrollments: {
            include: {
              group: { include: { subject: true, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } },
            },
          },
          grades: { orderBy: { date: 'desc' }, take: 10 },
          payments: { orderBy: { year: 'desc' }, take: 6 },
        },
      });

      if (!student) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } });
        return;
      }

      // Access control: students can only view their own profile
      if (req.user!.role === 'student') {
        const self = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
        if (!self || self.id !== student.id) {
          res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
          return;
        }
      }

      res.status(200).json({ success: true, data: { student } });
    } catch (err) { next(err); }
  }

  /**
   * GET /students/me  (student)
   * Returns the student profile for the currently logged-in student.
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await prisma.student.findUnique({
        where: { userId: req.user!.userId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, status: true } },
          enrollments: {
            where: { isActive: true },
            include: {
              group: {
                include: {
                  subject: true,
                  teacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
                  schedules: true,
                },
              },
            },
          },
          grades: { orderBy: { date: 'desc' }, take: 20 },
          payments: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 },
        },
      });

      if (!student) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } });
        return;
      }

      res.status(200).json({ success: true, data: { student } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /students/:id  (admin, self)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dateOfBirth, bio, address, parentName, parentPhone, notes } = req.body as {
        dateOfBirth?: string; bio?: string; address?: string;
        parentName?: string; parentPhone?: string; notes?: string;
      };

      // Students can only update their own profile
      if (req.user!.role === 'student') {
        const self = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
        if (!self || self.id !== req.params.id) {
          res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
          return;
        }
        // Students cannot change admin-only fields
        if (notes !== undefined && req.user!.role === 'student') {
          res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Students cannot set notes.' } });
          return;
        }
      }

      const student = await prisma.student.update({
        where: { id: req.params.id },
        data: {
          ...(dateOfBirth  !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
          ...(bio          !== undefined && { bio }),
          ...(address      !== undefined && { address }),
          ...(parentName   !== undefined && { parentName }),
          ...(parentPhone  !== undefined && { parentPhone }),
          ...(notes        !== undefined && { notes }),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.status(200).json({ success: true, data: { student } });
    } catch (err) { next(err); }
  }

  /**
   * GET /students/:id/attendance  (admin, teacher, self)
   */
  async getAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId, from, to } = req.query as Record<string, string>;

      const where: Record<string, unknown> = { studentId: req.params.id };
      if (groupId) where.groupStudent = { groupId };
      if (from || to) {
        where.classSession = {
          date: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to) }),
          },
        };
      }

      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          classSession: { select: { date: true, topic: true, group: { select: { name: true } } } },
        },
        orderBy: { classSession: { date: 'desc' } },
      });

      const summary = attendance.reduce((acc: Record<string, number>, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});

      res.status(200).json({ success: true, data: { attendance, summary } });
    } catch (err) { next(err); }
  }

  /**
   * GET /students/:id/grades  (admin, teacher, self)
   */
  async getGrades(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId, type } = req.query as Record<string, string>;

      const where: Record<string, unknown> = { studentId: req.params.id };
      if (groupId) where.groupStudent = { groupId };
      if (type)    where.type = type;

      const grades = await prisma.grade.findMany({
        where,
        include: {
          gradedBy: { select: { firstName: true, lastName: true } },
          groupStudent: { include: { group: { include: { subject: true } } } },
        },
        orderBy: { date: 'desc' },
      });

      // Compute average
      const avg = grades.length
        ? grades.reduce((sum, g) => sum + (Number(g.score) / Number(g.maxScore)) * 100, 0) / grades.length
        : null;

      res.status(200).json({ success: true, data: { grades, averagePercentage: avg } });
    } catch (err) { next(err); }
  }
}

export const studentsController = new StudentsController();
