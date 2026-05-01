import { Router } from 'express';

import authRoutes         from './auth.routes';
import usersRoutes        from './users.routes';
import studentsRoutes     from './students.routes';
import teachersRoutes     from './teachers.routes';
import subjectsRoutes     from './subjects.routes';
import groupsRoutes       from './groups.routes';
import sessionsRoutes     from './sessions.routes';
import gradesRoutes       from './grades.routes';
import paymentsRoutes     from './payments.routes';
import announcementsRoutes from './announcements.routes';
import dashboardRoutes    from './dashboard.routes';

const router = Router();

// ─── Public / Auth ────────────────────────────────────────────────────────────
router.use('/auth',          authRoutes);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.use('/dashboard',     dashboardRoutes);

// ─── Users & Profiles ─────────────────────────────────────────────────────────
router.use('/users',         usersRoutes);
router.use('/students',      studentsRoutes);
router.use('/teachers',      teachersRoutes);

// ─── Academic Structure ───────────────────────────────────────────────────────
router.use('/subjects',      subjectsRoutes);
router.use('/groups',        groupsRoutes);

// ─── Sessions, Grades, Payments ───────────────────────────────────────────────
router.use('/sessions',      sessionsRoutes);
router.use('/grades',        gradesRoutes);
router.use('/payments',      paymentsRoutes);

// ─── Communication ────────────────────────────────────────────────────────────
router.use('/announcements', announcementsRoutes);

export default router;
