import { Request, Response, NextFunction } from 'express';
import { GradeType } from '@prisma/client';
import prisma from '../lib/prisma';

export class GradesController {
  /**
   * GET /groups/:groupId/grades  (admin, teacher)
   * All grades for a group, optionally filtered by student or type.
   */
  async listForGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, type, from, to } = req.query as Record<string, string>;

      const where: Record<string, unknown> = {
        groupStudent: { groupId: req.params.groupId },
      };
      if (studentId) where.studentId = studentId;
      if (type)      where.type = type as GradeType;
      if (from || to) {
        where.date = {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(to) }),
        };
      }

      const grades = await prisma.grade.findMany({
        where,
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          gradedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
      });

      res.status(200).json({ success: true, data: { grades } });
    } catch (err) { next(err); }
  }

  /**
   * POST /groups/:groupId/grades  (admin, teacher)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, type, title, score, maxScore, date, notes } = req.body as {
        studentId: string; type: GradeType; title: string;
        score: number; maxScore?: number; date: string; notes?: string;
      };

      // Find the GroupStudent record
      const groupStudent = await prisma.groupStudent.findUnique({
        where: { groupId_studentId: { groupId: req.params.groupId, studentId } },
      });

      if (!groupStudent) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student is not enrolled in this group.' } });
        return;
      }

      const grade = await prisma.grade.create({
        data: {
          studentId,
          groupStudentId: groupStudent.id,
          gradedById:     req.user!.userId,
          type,
          title,
          score,
          maxScore:       maxScore ?? 100,
          date:           new Date(date),
          notes,
        },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          gradedBy: { select: { firstName: true, lastName: true } },
        },
      });

      res.status(201).json({ success: true, data: { grade } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /grades/:id  (admin, teacher — grader only)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, title, score, maxScore, date, notes } = req.body as {
        type?: GradeType; title?: string; score?: number; maxScore?: number; date?: string; notes?: string;
      };

      const grade = await prisma.grade.update({
        where: { id: req.params.id },
        data: {
          ...(type     && { type }),
          ...(title    !== undefined && { title }),
          ...(score    !== undefined && { score }),
          ...(maxScore !== undefined && { maxScore }),
          ...(date     && { date: new Date(date) }),
          ...(notes    !== undefined && { notes }),
        },
      });

      res.status(200).json({ success: true, data: { grade } });
    } catch (err) { next(err); }
  }

  /**
   * DELETE /grades/:id  (admin)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.grade.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const gradesController = new GradesController();
