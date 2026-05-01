import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { classSessionsController } from '../controllers/class-sessions.controller';

const router = Router();

router.use(authenticate);

// Individual session operations (not nested under group)
router.get('/:id',              authorize('admin', 'teacher'),          (req, res, next) => classSessionsController.getById(req, res, next));
router.patch('/:id',            authorize('admin', 'teacher'),          (req, res, next) => classSessionsController.update(req, res, next));
router.put('/:id/attendance',   authorize('admin', 'teacher'),          (req, res, next) => classSessionsController.bulkUpdateAttendance(req, res, next));

export default router;
