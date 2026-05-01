import { Request, Response, NextFunction } from 'express';
import { AnnouncementTarget } from '@prisma/client';
import prisma from '../lib/prisma';

export class AnnouncementsController {
  /**
   * GET /announcements  (all authenticated)
   * Students see only announcements targeting 'all' or 'students'.
   * Teachers see 'all' or 'teachers'. Admins see everything.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isPinned, page = '1', limit = '20' } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));

      // Build target filter based on role
      const role = req.user!.role;
      const targetFilter: AnnouncementTarget[] =
        role === 'admin'   ? ['all', 'students', 'teachers'] :
        role === 'teacher' ? ['all', 'teachers'] :
                             ['all', 'students'];

      const where: Record<string, unknown> = {
        target: { in: targetFilter },
      };
      if (isPinned !== undefined) where.isPinned = isPinned === 'true';

      const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
          where,
          skip: (pageNum - 1) * pageSize,
          take: pageSize,
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          include: {
            author: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        }),
        prisma.announcement.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          announcements,
          pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /announcements/:id  (all authenticated)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const announcement = await prisma.announcement.findUnique({
        where: { id: req.params.id },
        include: {
          author: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      if (!announcement) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Announcement not found.' } });
        return;
      }

      res.status(200).json({ success: true, data: { announcement } });
    } catch (err) { next(err); }
  }

  /**
   * POST /announcements  (admin)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, body, target, isPinned } = req.body as {
        title: string; body: string; target?: AnnouncementTarget; isPinned?: boolean;
      };

      const announcement = await prisma.announcement.create({
        data: {
          title,
          body,
          authorId: req.user!.userId,
          target:   target   ?? 'all',
          isPinned: isPinned ?? false,
        },
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
      });

      res.status(201).json({ success: true, data: { announcement } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /announcements/:id  (admin, author)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, body, target, isPinned } = req.body as {
        title?: string; body?: string; target?: AnnouncementTarget; isPinned?: boolean;
      };

      // Only admin or the original author can edit
      const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Announcement not found.' } });
        return;
      }

      if (req.user!.role !== 'admin' && existing.authorId !== req.user!.userId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the author or admin can edit this announcement.' } });
        return;
      }

      const announcement = await prisma.announcement.update({
        where: { id: req.params.id },
        data: {
          ...(title    !== undefined && { title }),
          ...(body     !== undefined && { body }),
          ...(target   && { target }),
          ...(isPinned !== undefined && { isPinned }),
        },
      });

      res.status(200).json({ success: true, data: { announcement } });
    } catch (err) { next(err); }
  }

  /**
   * DELETE /announcements/:id  (admin)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.announcement.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const announcementsController = new AnnouncementsController();
