import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { announcementsController } from '../controllers/announcements.controller';

const router = Router();

router.use(authenticate);

router.get('/',       (req, res, next) => announcementsController.list(req, res, next));
router.get('/:id',    (req, res, next) => announcementsController.getById(req, res, next));
router.post('/',      authorize('admin'),          (req, res, next) => announcementsController.create(req, res, next));
router.patch('/:id',  authorize('admin', 'teacher'), (req, res, next) => announcementsController.update(req, res, next));
router.delete('/:id', authorize('admin'),          (req, res, next) => announcementsController.delete(req, res, next));

export default router;
