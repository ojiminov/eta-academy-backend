import { Request, Response, NextFunction } from 'express';
import { SubjectCategory } from '@prisma/client';
import prisma from '../lib/prisma';

export class SubjectsController {
  /**
   * GET /subjects  (all authenticated)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, isActive } = req.query as Record<string, string>;

      const where: Record<string, unknown> = {};
      if (category) where.category = category as SubjectCategory;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const subjects = await prisma.subject.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { groups: true } },
        },
      });

      res.status(200).json({ success: true, data: { subjects } });
    } catch (err) { next(err); }
  }

  /**
   * GET /subjects/:id  (all authenticated)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: req.params.id },
        include: {
          groups: {
            where: { status: 'active' },
            include: {
              teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
              _count: { select: { students: { where: { isActive: true } } } },
            },
          },
        },
      });

      if (!subject) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found.' } });
        return;
      }

      res.status(200).json({ success: true, data: { subject } });
    } catch (err) { next(err); }
  }

  /**
   * POST /subjects  (admin)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, code, description, category } = req.body as {
        name: string; code: string; description?: string; category?: SubjectCategory;
      };

      const subject = await prisma.subject.create({
        data: {
          name,
          code: code.toUpperCase().trim(),
          description,
          category: category ?? 'english',
        },
      });

      res.status(201).json({ success: true, data: { subject } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /subjects/:id  (admin)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, code, description, category, isActive } = req.body as {
        name?: string; code?: string; description?: string; category?: SubjectCategory; isActive?: boolean;
      };

      const subject = await prisma.subject.update({
        where: { id: req.params.id },
        data: {
          ...(name        !== undefined && { name }),
          ...(code        !== undefined && { code: code.toUpperCase().trim() }),
          ...(description !== undefined && { description }),
          ...(category    && { category }),
          ...(isActive    !== undefined && { isActive }),
        },
      });

      res.status(200).json({ success: true, data: { subject } });
    } catch (err) { next(err); }
  }

  /**
   * DELETE /subjects/:id  (admin) — soft delete via isActive
   */
  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.subject.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export const subjectsController = new SubjectsController();
