import { Request, Response, NextFunction } from 'express';
import { PaymentStatus } from '@prisma/client';
import prisma from '../lib/prisma';

export class PaymentsController {
  /**
   * GET /payments  (admin)
   * List payments with filters.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, groupId, status, month, year, page = '1', limit = '20' } = req.query as Record<string, string>;

      const pageNum  = Math.max(1, parseInt(page));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
      const skip     = (pageNum - 1) * pageSize;

      const where: Record<string, unknown> = {};
      if (studentId) where.studentId = studentId;
      if (groupId)   where.groupId   = groupId;
      if (status)    where.status    = status as PaymentStatus;
      if (month)     where.month     = parseInt(month);
      if (year)      where.year      = parseInt(year);

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            group:   { include: { subject: true } },
            invoice: true,
          },
        }),
        prisma.payment.count({ where }),
      ]);

      // Revenue summary
      const paid = await prisma.payment.aggregate({
        where: { ...where, status: 'paid' },
        _sum: { amount: true },
      });
      const overdue = await prisma.payment.count({ where: { ...where, status: 'overdue' } });

      res.status(200).json({
        success: true,
        data: {
          payments,
          pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
          summary: { totalPaid: paid._sum.amount ?? 0, overdueCount: overdue },
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /payments/me  (student)
   * The student's own payment history.
   */
  async getMyPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
      if (!student) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } });
        return;
      }

      const payments = await prisma.payment.findMany({
        where: { studentId: student.id },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: {
          group: { include: { subject: true } },
          invoice: true,
        },
      });

      res.status(200).json({ success: true, data: { payments } });
    } catch (err) { next(err); }
  }

  /**
   * POST /payments  (admin)
   * Create a payment record (e.g. monthly tuition invoice).
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, groupId, amount, currency, month, year, method, notes } = req.body as {
        studentId: string; groupId: string; amount: number; currency?: string;
        month: number; year: number; method?: string; notes?: string;
      };

      const payment = await prisma.payment.create({
        data: {
          studentId,
          groupId,
          amount,
          currency: currency ?? 'USD',
          month,
          year,
          method,
          notes,
          status: PaymentStatus.pending,
        },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          group:   { include: { subject: true } },
        },
      });

      res.status(201).json({ success: true, data: { payment } });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /payments/:id  (admin)
   * Update payment status (mark as paid, overdue, cancelled).
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, paidAt, method, receiptUrl, notes } = req.body as {
        status?: PaymentStatus; paidAt?: string;
        method?: string; receiptUrl?: string; notes?: string;
      };

      const data: Record<string, unknown> = {};
      if (status    !== undefined) data.status    = status;
      if (method    !== undefined) data.method    = method;
      if (receiptUrl !== undefined) data.receiptUrl = receiptUrl;
      if (notes     !== undefined) data.notes     = notes;

      // Auto-set paidAt when marking as paid
      if (status === 'paid') {
        data.paidAt = paidAt ? new Date(paidAt) : new Date();
      }

      const payment = await prisma.payment.update({
        where: { id: req.params.id },
        data,
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          group:   { include: { subject: true } },
          invoice: true,
        },
      });

      res.status(200).json({ success: true, data: { payment } });
    } catch (err) { next(err); }
  }

  /**
   * POST /payments/bulk-generate  (admin)
   * Generate monthly payment records for all active students in all active groups.
   */
  async bulkGenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { month, year } = req.body as { month: number; year: number };

      // Get all active group enrollments with monthly fee
      const enrollments = await prisma.groupStudent.findMany({
        where: { isActive: true, group: { status: 'active' } },
        include: { group: true },
      });

      let created = 0;
      let skipped = 0;

      for (const enrollment of enrollments) {
        try {
          await prisma.payment.create({
            data: {
              studentId: enrollment.studentId,
              groupId:   enrollment.groupId,
              amount:    enrollment.group.monthlyFee,
              currency:  enrollment.group.currency,
              month,
              year,
              status:    PaymentStatus.pending,
            },
          });
          created++;
        } catch {
          // @@unique([studentId, groupId, month, year]) — skip duplicates
          skipped++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Generated ${created} payment records (${skipped} already existed).`,
        data: { created, skipped },
      });
    } catch (err) { next(err); }
  }
}

export const paymentsController = new PaymentsController();
