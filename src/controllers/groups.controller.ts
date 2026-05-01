import { Request, Response, NextFunction } from 'express';
import { GroupStatus } from '@prisma/client';
import prisma from '../lib/prisma';

export class GroupsController {
  /**
   * GET /groups  (admin, teacher)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { teacherId, subjectId, status, search, page = '1', limit = '20' } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
      const skip     = (pageNum - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (status)    where.status    = status as GroupStatus;
      if (subjectId) where.subjectId = subjectId;

      // Teachers only see their own groups
      if (req.user!.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.userId } });
        where.teacherId = teacher?.id;
      } else if (teacherId) {
        where.teacherId = teacherId;
      }

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [groups, total] = await Promise.all([
        prisma.group.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            subject: true,
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
            schedules: true,
            _count: { select: { students: { where: { isActive: true } } } },
          },
        }),
        prisma.group.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          groups,
          pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /groups/:id  (admin, teacher)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: req.params.id },
        include: {
          subject: true,
          teacher: { include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } } },
          schedules: true,
          students: {
            where: { isActive: true },
            include: {
              student: {
                include: {
                  user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
          classSessions: { orderBy: { date: 'desc' }, take: 10 },
        },
      });

      if (!group) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } });
        return;
      }

      res.status(200).json({ success: true, data: { group } });
    } catch (err) { next(err); }
  }

  /**
   * POST /groups  (admin)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        name, subjectId, teacherId, level, room, maxStudents,
        startDate, endDate, monthlyFee, currency, description,
      } = req.body as {
        name: string; subjectId: string; teacherId: string; level?: string;
        room?: string; maxStudents?: number; startDate: string; endDate?: string;
        monthlyFee?: number; currency?: string; description?: string;
      };

      const group = await prisma.group.create({
        data: {
          name,
          subjectId,
          teacherId,
          level:       level       ?? 'A1',
          room,
          maxStudents: maxStudents ?? 15,
          startDate:   new Date(startDate),
          endDate:     endDate ? new Date(endDate) : null,
          monthlyFee:  monthlyFee ?? 0,
          currency:    currency   ?? 'USD',
          description,
        },
        include: {
          subject: true,
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      });

      res.status(201).json({ success: true, data: { group } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /groups/:id  (admin)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        name, teacherId, level, room, maxStudents,
        status, endDate, monthlyFee, currency, description,
      } = req.body as {
        name?: string; teacherId?: string; level?: string; room?: string;
        maxStudents?: number; status?: GroupStatus; endDate?: string;
        monthlyFee?: number; currency?: string; description?: string;
      };

      const group = await prisma.group.update({
        where: { id: req.params.id },
        data: {
          ...(name        !== undefined && { name }),
          ...(teacherId   && { teacherId }),
          ...(level       !== undefined && { level }),
          ...(room        !== undefined && { room }),
          ...(maxStudents !== undefined && { maxStudents }),
          ...(status      && { status }),
          ...(endDate     !== undefined && { endDate: endDate ? new Date(endDate) : null }),
          ...(monthlyFee  !== undefined && { monthlyFee }),
          ...(currency    && { currency }),
          ...(description !== undefined && { description }),
        },
        include: {
          subject: true,
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          schedules: true,
        },
      });

      res.status(200).json({ success: true, data: { group } });
    } catch (err) { next(err); }
  }

  /**
   * POST /groups/:id/enroll  (admin)
   * Enroll a student into a group.
   */
  async enrollStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, notes } = req.body as { studentId: string; notes?: string };
      const groupId = req.params.id;

      // Check capacity
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { _count: { select: { students: { where: { isActive: true } } } } },
      });

      if (!group) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } });
        return;
      }

      if (group._count.students >= group.maxStudents) {
        res.status(400).json({ success: false, error: { code: 'GROUP_FULL', message: 'Group has reached maximum capacity.' } });
        return;
      }

      // Upsert: if student was previously dropped, re-activate
      const existing = await prisma.groupStudent.findUnique({
        where: { groupId_studentId: { groupId, studentId } },
      });

      let enrollment;
      if (existing) {
        enrollment = await prisma.groupStudent.update({
          where: { id: existing.id },
          data: { isActive: true, droppedAt: null, enrolledAt: new Date(), notes },
        });
      } else {
        enrollment = await prisma.groupStudent.create({
          data: { groupId, studentId, notes },
        });
      }

      res.status(201).json({ success: true, data: { enrollment } });
    } catch (err) { next(err); }
  }

  /**
   * DELETE /groups/:id/enroll/:studentId  (admin)
   * Remove (drop) a student from a group.
   */
  async dropStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: groupId, studentId } = req.params;

      await prisma.groupStudent.update({
        where: { groupId_studentId: { groupId, studentId } },
        data: { isActive: false, droppedAt: new Date() },
      });

      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const groupsController = new GroupsController();
