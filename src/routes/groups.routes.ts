import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { groupsController } from '../controllers/groups.controller';
import { schedulesController } from '../controllers/schedules.controller';
import { classSessionsController } from '../controllers/class-sessions.controller';
import { gradesController } from '../controllers/grades.controller';

const router = Router();

router.use(authenticate);

// Groups CRUD
router.get('/',    authorize('admin', 'teacher'),  (req, res, next) => groupsController.list(req, res, next));
router.post('/',   authorize('admin'),              (req, res, next) => groupsController.create(req, res, next));
router.get('/:id', authorize('admin', 'teacher'),  (req, res, next) => groupsController.getById(req, res, next));
router.patch('/:id', authorize('admin'),            (req, res, next) => groupsController.update(req, res, next));

// Enrollment management
router.post('/:id/enroll',                 authorize('admin'),          (req, res, next) => groupsController.enrollStudent(req, res, next));
router.delete('/:id/enroll/:studentId',    authorize('admin'),          (req, res, next) => groupsController.dropStudent(req, res, next));

// Schedules nested under group
router.get('/:groupId/schedules',              authorize('admin', 'teacher', 'student'), (req, res, next) => schedulesController.listForGroup(req, res, next));
router.post('/:groupId/schedules',             authorize('admin'),                       (req, res, next) => schedulesController.create(req, res, next));
router.patch('/:groupId/schedules/:id',        authorize('admin'),                       (req, res, next) => schedulesController.update(req, res, next));
router.delete('/:groupId/schedules/:id',       authorize('admin'),                       (req, res, next) => schedulesController.delete(req, res, next));

// Class sessions nested under group
router.get('/:groupId/sessions',               authorize('admin', 'teacher'),           (req, res, next) => classSessionsController.listForGroup(req, res, next));
router.post('/:groupId/sessions',              authorize('admin', 'teacher'),           (req, res, next) => classSessionsController.create(req, res, next));

// Grades nested under group
router.get('/:groupId/grades',                 authorize('admin', 'teacher'),           (req, res, next) => gradesController.listForGroup(req, res, next));
router.post('/:groupId/grades',                authorize('admin', 'teacher'),           (req, res, next) => gradesController.create(req, res, next));

export default router;
