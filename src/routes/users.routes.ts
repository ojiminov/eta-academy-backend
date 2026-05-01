import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { usersController } from '../controllers/users.controller';

const router = Router();

router.use(authenticate);

// Admin-only routes
router.get('/stats',  authorize('admin'), (req, res, next) => usersController.stats(req, res, next));
router.get('/',       authorize('admin'), (req, res, next) => usersController.list(req, res, next));
router.get('/:id',    authorize('admin'), (req, res, next) => usersController.getById(req, res, next));
router.patch('/:id',  authorize('admin'), (req, res, next) => usersController.update(req, res, next));
router.delete('/:id', authorize('admin'), (req, res, next) => usersController.softDelete(req, res, next));

export default router;
