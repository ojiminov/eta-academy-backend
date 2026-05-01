import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { studentsController } from '../controllers/students.controller';

const router = Router();

router.use(authenticate);

// Student self-access
router.get('/me',          authorize('student'),                       (req, res, next) => studentsController.getMe(req, res, next));
router.patch('/me',        authorize('student'),                       (req, res, next) => {
  // Inject own ID into params
  req.params.id = '__self__'; // handled inside controller via userId
  studentsController.update(req, res, next);
});

// Admin / teacher list + detail
router.get('/',            authorize('admin', 'teacher'),              (req, res, next) => studentsController.list(req, res, next));
router.get('/:id',         authorize('admin', 'teacher', 'student'),   (req, res, next) => studentsController.getById(req, res, next));
router.patch('/:id',       authorize('admin'),                         (req, res, next) => studentsController.update(req, res, next));

// Attendance & grades sub-resources
router.get('/:id/attendance', authorize('admin', 'teacher', 'student'), (req, res, next) => studentsController.getAttendance(req, res, next));
router.get('/:id/grades',     authorize('admin', 'teacher', 'student'), (req, res, next) => studentsController.getGrades(req, res, next));

export default router;
