import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { paymentsController } from '../controllers/payments.controller';

const router = Router();

router.use(authenticate);

router.get('/me',             authorize('student'),        (req, res, next) => paymentsController.getMyPayments(req, res, next));
router.get('/',               authorize('admin'),          (req, res, next) => paymentsController.list(req, res, next));
router.post('/',              authorize('admin'),          (req, res, next) => paymentsController.create(req, res, next));
router.post('/bulk-generate', authorize('admin'),          (req, res, next) => paymentsController.bulkGenerate(req, res, next));
router.patch('/:id',          authorize('admin'),          (req, res, next) => paymentsController.update(req, res, next));

export default router;
