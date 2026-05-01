import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as superAdminController from '../controllers/superAdminController';

const router = Router();

// All routes here require SUPER_ADMIN role
router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/stats', superAdminController.getSystemStats);
router.get('/institutions', superAdminController.getInstitutions);
router.patch('/institutions/:id/status', superAdminController.updateInstitutionStatus);
router.delete('/institutions/:id', superAdminController.deleteInstitution);
router.post('/diagnostics', superAdminController.runDiagnostics);
router.get('/activity', superAdminController.getRecentActivity);

export default router;
