import { Request, Response, NextFunction } from 'express';
import { AttendanceStatus } from '@prisma/client';
import prisma from '../lib/prisma';

export class ClassSessionsController {
  /**
   * GET /groups/:groupId/sessions  (admin, teacher)
   */
  async listForGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to, page = '1', limit = '20' } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));

      const where: Record<string, unknown> = { groupId: req.params.groupId };
      if (from || to) {
        where.date = {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(to) }),
        };
      }

      const [sessions, total] = await Promise.all([
        prisma.classSession.findMany({
          where,
          skip: (pageNum - 1) * pageSize,
          take: pageSize,
          orderBy: { date: 'desc' },
          include: {
            attendance: {
              include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        }),
        prisma.classSession.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          sessions,
          pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /sessions/:id  (admin, teacher)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await prisma.classSession.findUnique({
        where: { id: req.params.id },
        include: {
          group: { include: { subject: true } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          attendance: {
            include: {
              student: {
                include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
              },
            },
          },
        },
      });

      if (!session) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } });
        return;
      }

      res.status(200).json({ success: true, data: { session } });
    } catch (err) { next(err); }
  }

  /**
   * POST /groups/:groupId/sessions  (admin, teacher)
   * Create a class session and optionally bulk-create attendance records.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date, topic, notes, homeworkDesc, teacherId: bodyTeacherId } = req.body as {
        date: string; topic?: string; notes?: string; homeworkDesc?: string; teacherId?: string;
      };

      // Resolve teacherId: admins can specify, teachers use their own
      let resolvedTeacherId = bodyTeacherId;
      if (req.user!.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.userId } });
        if (!teacher) {
          res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Teacher profile not found.' } });
          return;
        }
        resolvedTeacherId = teacher.id;
      }

      if (!resolvedTeacherId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'teacherId is required.' } });
        return;
      }

      const session = await prisma.classSession.create({
        data: {
          groupId:     req.params.groupId,
          teacherId:   resolvedTeacherId,
          date:        new Date(date),
          topic,
          notes,
          homeworkDesc,
        },
      });

      // Auto-create attendance records for all active students in the group
      const groupStudents = await prisma.groupStudent.findMany({
        where: { groupId: req.params.groupId, isActive: true },
      });

      if (groupStudents.length > 0) {
        await prisma.attendance.createMany({
          data: groupStudents.map(gs => ({
            classSessionId: session.id,
            studentId:      gs.studentId,
            groupStudentId: gs.id,
            status:         AttendanceStatus.present, // default, teacher will update
          })),
          skipDuplicates: true,
        });
      }

      const fullSession = await prisma.classSession.findUnique({
        where: { id: session.id },
        include: {
          attendance: {
            include: {
              student: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
      });

      res.status(201).json({ success: true, data: { session: fullSession } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /sessions/:id  (admin, teacher)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date, topic, notes, homeworkDesc } = req.body as {
        date?: string; topic?: string; notes?: string; homeworkDesc?: string;
      };

      const session = await prisma.classSession.update({
        where: { id: req.params.id },
        data: {
          ...(date        && { date: new Date(date) }),
          ...(topic       !== undefined && { topic }),
          ...(notes       !== undefined && { notes }),
          ...(homeworkDesc !== undefined && { homeworkDesc }),
        },
      });

      res.status(200).json({ success: true, data: { session } });
    } catch (err) { next(err); }
  }

  /**
   * PUT /sessions/:id/attendance  (admin, teacher)
   * Bulk update attendance for an entire session.
   * Body: { records: [{ studentId, status, note }] }
   */
  async bulkUpdateAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { records } = req.body as {
        records: { studentId: string; status: AttendanceStatus; note?: string }[];
      };

      const updates = await Promise.all(
        records.map(r =>
          prisma.attendance.update({
            where: { classSessionId_studentId: { classSessionId: req.params.id, studentId: r.studentId } },
            data: { status: r.status, note: r.note },
          }),
        ),
      );

      res.status(200).json({ success: true, data: { updated: updates.length } });
    } catch (err) { next(err); }
  }
}

export const classSessionsController = new ClassSessionsController();
