import { Request, Response, NextFunction } from 'express';
import { DayOfWeek } from '@prisma/client';
import prisma from '../lib/prisma';

export class SchedulesController {
  /**
   * GET /groups/:groupId/schedules  (admin, teacher, student in group)
   */
  async listForGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedules = await prisma.schedule.findMany({
        where: { groupId: req.params.groupId },
        orderBy: { dayOfWeek: 'asc' },
      });
      res.status(200).json({ success: true, data: { schedules } });
    } catch (err) { next(err); }
  }

  /**
   * POST /groups/:groupId/schedules  (admin)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dayOfWeek, startTime, endTime, room } = req.body as {
        dayOfWeek: DayOfWeek; startTime: string; endTime: string; room?: string;
      };

      const schedule = await prisma.schedule.create({
        data: {
          groupId: req.params.groupId,
          dayOfWeek,
          startTime,
          endTime,
          room,
        },
      });

      res.status(201).json({ success: true, data: { schedule } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /groups/:groupId/schedules/:id  (admin)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dayOfWeek, startTime, endTime, room } = req.body as {
        dayOfWeek?: DayOfWeek; startTime?: string; endTime?: string; room?: string;
      };

      const schedule = await prisma.schedule.update({
        where: { id: req.params.id },
        data: {
          ...(dayOfWeek  && { dayOfWeek }),
          ...(startTime  && { startTime }),
          ...(endTime    && { endTime }),
          ...(room !== undefined && { room }),
        },
      });

      res.status(200).json({ success: true, data: { schedule } });
    } catch (err) { next(err); }
  }

  /**
   * DELETE /groups/:groupId/schedules/:id  (admin)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.schedule.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const schedulesController = new SchedulesController();
