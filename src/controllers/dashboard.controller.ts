import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export class DashboardController {
  /**
   * GET /dashboard/admin
   * Top-level KPIs for the admin panel.
   */
  async adminDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const now   = new Date();
      const month = now.getMonth() + 1;
      const year  = now.getFullYear();

      const [
        totalStudents,
        totalTeachers,
        activeGroups,
        totalGroups,
        pendingPayments,
        paidThisMonth,
        overduePayments,
        recentAnnouncements,
        upcomingSessions,
        attendanceThisMonth,
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'student', status: 'active' } }),
        prisma.user.count({ where: { role: 'teacher', status: 'active' } }),
        prisma.group.count({ where: { status: 'active' } }),
        prisma.group.count(),
        prisma.payment.count({ where: { status: 'pending' } }),
        prisma.payment.aggregate({
          where: { status: 'paid', month, year },
          _sum: { amount: true },
        }),
        prisma.payment.count({ where: { status: 'overdue' } }),
        prisma.announcement.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { author: { select: { firstName: true, lastName: true } } },
        }),
        prisma.classSession.findMany({
          where: { date: { gte: now } },
          orderBy: { date: 'asc' },
          take: 10,
          include: {
            group: { include: { subject: true } },
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        }),
        prisma.attendance.groupBy({
          by: ['status'],
          where: {
            classSession: {
              date: {
                gte: new Date(year, month - 1, 1),
                lte: new Date(year, month, 0),
              },
            },
          },
          _count: true,
        }),
      ]);

      // Revenue by month (last 6 months)
      const revenueByMonth = [];
      for (let i = 5; i >= 0; i--) {
        const d   = new Date(year, month - 1 - i, 1);
        const m   = d.getMonth() + 1;
        const y   = d.getFullYear();
        const agg = await prisma.payment.aggregate({
          where: { status: 'paid', month: m, year: y },
          _sum: { amount: true },
        });
        revenueByMonth.push({ month: m, year: y, amount: Number(agg._sum.amount ?? 0) });
      }

      const attendanceSummary = attendanceThisMonth.reduce((acc: Record<string, number>, r) => {
        acc[r.status] = r._count;
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          kpis: {
            totalStudents,
            totalTeachers,
            activeGroups,
            totalGroups,
            pendingPayments,
            overduePayments,
            revenueThisMonth: Number(paidThisMonth._sum.amount ?? 0),
          },
          revenueByMonth,
          attendanceSummary,
          recentAnnouncements,
          upcomingSessions,
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /dashboard/teacher
   * Teacher's personal dashboard: their groups, today's sessions, pending grading.
   */
  async teacherDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.userId } });
      if (!teacher) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Teacher profile not found.' } });
        return;
      }

      const now   = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [myGroups, todaySessions, recentSessions, totalStudents] = await Promise.all([
        prisma.group.findMany({
          where: { teacherId: teacher.id, status: 'active' },
          include: {
            subject: true,
            schedules: true,
            _count: { select: { students: { where: { isActive: true } } } },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.classSession.findMany({
          where: { teacherId: teacher.id, date: today },
          include: {
            group: { include: { subject: true } },
            attendance: { select: { status: true } },
          },
        }),
        prisma.classSession.findMany({
          where: { teacherId: teacher.id, date: { lt: today } },
          orderBy: { date: 'desc' },
          take: 5,
          include: { group: { include: { subject: true } } },
        }),
        prisma.groupStudent.count({
          where: { group: { teacherId: teacher.id }, isActive: true },
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          teacher,
          kpis: {
            activeGroups: myGroups.length,
            totalStudents,
            todaySessions: todaySessions.length,
          },
          myGroups,
          todaySessions,
          recentSessions,
        },
      });
    } catch (err) { next(err); }
  }

  /**
   * GET /dashboard/student
   * Student's personal dashboard: their groups, upcoming schedule, grades, payments.
   */
  async studentDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
      if (!student) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } });
        return;
      }

      const now   = new Date();
      const month = now.getMonth() + 1;
      const year  = now.getFullYear();

      const [myGroups, recentGrades, payments, attendanceSummary, announcements] = await Promise.all([
        prisma.groupStudent.findMany({
          where: { studentId: student.id, isActive: true },
          include: {
            group: {
              include: {
                subject: true,
                teacher: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
                schedules: true,
              },
            },
          },
        }),
        prisma.grade.findMany({
          where: { studentId: student.id },
          orderBy: { date: 'desc' },
          take: 10,
          include: {
            groupStudent: { include: { group: { include: { subject: true } } } },
          },
        }),
        prisma.payment.findMany({
          where: { studentId: student.id },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 6,
          include: { group: { include: { subject: true } } },
        }),
        prisma.attendance.groupBy({
          by: ['status'],
          where: {
            studentId: student.id,
            classSession: {
              date: {
                gte: new Date(year, month - 1, 1),
                lte: new Date(year, month, 0),
              },
            },
          },
          _count: true,
        }),
        prisma.announcement.findMany({
          where: { target: { in: ['all', 'students'] } },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          take: 5,
          include: { author: { select: { firstName: true, lastName: true } } },
        }),
      ]);

      // Compute attendance summary
      const attSummary = attendanceSummary.reduce((acc: Record<string, number>, r) => {
        acc[r.status] = r._count;
        return acc;
      }, {});

      // Compute average grade percentage
      const avgGrade = recentGrades.length
        ? recentGrades.reduce((sum, g) => sum + (Number(g.score) / Number(g.maxScore)) * 100, 0) / recentGrades.length
        : null;

      // Pending payments count
      const pendingCount = payments.filter(p => p.status === 'pending' || p.status === 'overdue').length;

      res.status(200).json({
        success: true,
        data: {
          student,
          kpis: {
            activeGroups: myGroups.length,
            avgGradePercentage: avgGrade ? Math.round(avgGrade) : null,
            attendanceThisMonth: attSummary,
            pendingPayments: pendingCount,
          },
          myGroups,
          recentGrades,
          payments,
          announcements,
        },
      });
    } catch (err) { next(err); }
  }
}

export const dashboardController = new DashboardController();
