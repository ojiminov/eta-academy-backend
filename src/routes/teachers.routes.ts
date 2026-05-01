import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { teachersController } from '../controllers/teachers.controller';

const router = Router();

router.use(authenticate);

router.get('/me',             authorize('teacher'),         (req, res, next) => teachersController.getMe(req, res, next));
router.get('/',               authorize('admin'),           (req, res, next) => teachersController.list(req, res, next));
router.get('/:id',            authorize('admin', 'teacher'), (req, res, next) => teachersController.getById(req, res, next));
router.patch('/:id',          authorize('admin', 'teacher'), (req, res, next) => teachersController.update(req, res, next));
router.get('/:id/schedule',   authorize('admin', 'teacher'), (req, res, next) => teachersController.getSchedule(req, res, next));

export default router;
