import { Router } from 'express';
import { getAllAlerts, createAlert } from '../controllers/alertController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getAllAlerts);
router.post('/', authenticate, authorize('SCHOOL_ADMIN', 'SECURITY'), createAlert);


export default router;
