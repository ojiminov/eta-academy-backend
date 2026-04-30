import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';

const router = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ─── Stub routes — coming soon ────────────────────────────────────────────────

router.use('/students', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Students API — coming soon.',
  });
});

router.use('/courses', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Courses API — coming soon.',
  });
});

router.use('/enrollments', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Enrollments API — coming soon.',
  });
});

router.use('/payments', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Payments API — coming soon.',
  });
});

router.use('/certificates', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Certificates API — coming soon.',
  });
});

export default router;
