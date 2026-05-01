import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { dashboardController } from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/admin',   authorize('admin'),   (req, res, next) => dashboardController.adminDashboard(req, res, next));
router.get('/teacher', authorize('teacher'), (req, res, next) => dashboardController.teacherDashboard(req, res, next));
router.get('/student', authorize('student'), (req, res, next) => dashboardController.studentDashboard(req, res, next));

export default router;
