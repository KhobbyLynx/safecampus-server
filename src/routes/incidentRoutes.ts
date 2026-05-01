import { Router } from 'express';
import { createIncident, createSOSIncident, getMyIncidents, updateIncidentStatus, getIncidentStats, getAnalytics, assignIncident, getStudentReports, updateIncidentLocation, updateIncidentRemarks } from '../controllers/incidentController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Stats route
router.get('/stats', authenticate, getIncidentStats);
router.get('/analytics', authenticate, authorize('SCHOOL_ADMIN', 'SUPER_ADMIN'), getAnalytics);

// Student's own reports - must be before /:id routes
router.get('/my-reports', authenticate, getStudentReports);

// Public route for anonymous reporting (can be restricted later if needed)
router.post('/', (req, res, next) => {
  // If token provided, authenticate, otherwise continue as anonymous
  if (req.header('Authorization')) {
    return authenticate(req, res, next);
  }
  next();
}, createIncident);
router.post('/sos', authenticate, createSOSIncident);

// Protected routes
router.get('/', authenticate, getMyIncidents);
router.patch('/:id/status', authenticate, authorize('SCHOOL_ADMIN', 'SECURITY', 'SUPER_ADMIN'), updateIncidentStatus);
router.patch('/:id/assign', authenticate, authorize('SCHOOL_ADMIN', 'SECURITY', 'SUPER_ADMIN'), assignIncident);
router.patch('/:id/location', authenticate, authorize('SCHOOL_ADMIN', 'SECURITY', 'SUPER_ADMIN'), updateIncidentLocation);
router.patch('/:id/remarks', authenticate, authorize('SCHOOL_ADMIN', 'SECURITY', 'SUPER_ADMIN'), updateIncidentRemarks);

export default router;
