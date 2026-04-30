import { Router } from 'express';
import { getAllInstitutions, createInstitution, getInstitutionHotspots, updateInstitution } from '../controllers/institutionController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/list/public', getAllInstitutions); // Publicly accessible for onboarding signup selection
router.get('/:id/hotspots', authenticate, getInstitutionHotspots); // Auth required — users can only view own institution's landmarks
router.post('/', createInstitution); // Public — used during onboarding
router.patch('/:id', authenticate, authorize('SCHOOL_ADMIN', 'SUPER_ADMIN'), updateInstitution);

export default router;
