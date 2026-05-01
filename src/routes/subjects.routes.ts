import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { subjectsController } from '../controllers/subjects.controller';

const router = Router();

router.use(authenticate);

router.get('/',       (req, res, next) => subjectsController.list(req, res, next));
router.get('/:id',    (req, res, next) => subjectsController.getById(req, res, next));
router.post('/',      authorize('admin'), (req, res, next) => subjectsController.create(req, res, next));
router.patch('/:id',  authorize('admin'), (req, res, next) => subjectsController.update(req, res, next));
router.delete('/:id', authorize('admin'), (req, res, next) => subjectsController.deactivate(req, res, next));

export default router;
