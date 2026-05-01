import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { gradesController } from '../controllers/grades.controller';

const router = Router();

router.use(authenticate);

// Individual grade operations
router.patch('/:id',  authorize('admin', 'teacher'), (req, res, next) => gradesController.update(req, res, next));
router.delete('/:id', authorize('admin'),             (req, res, next) => gradesController.delete(req, res, next));

export default router;
