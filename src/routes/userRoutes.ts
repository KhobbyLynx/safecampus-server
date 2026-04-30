import { Router } from 'express';
import { getInstitutionOfficers, createOfficer, getProfile, updateProfile, updatePreferences, updateOfficerStatus, deleteOfficer, changePassword } from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.get('/officers', authenticate, authorize('SCHOOL_ADMIN', 'SUPER_ADMIN'), getInstitutionOfficers);
router.post('/officers', authenticate, authorize('SCHOOL_ADMIN', 'SUPER_ADMIN'), createOfficer);
router.patch('/profile', authenticate, updateProfile);
router.patch('/preferences', authenticate, updatePreferences);
router.patch('/change-password', authenticate, changePassword);
router.patch('/officers/:id', authenticate, authorize('SCHOOL_ADMIN', 'SUPER_ADMIN'), updateOfficerStatus);
router.delete('/officers/:id', authenticate, authorize('SCHOOL_ADMIN', 'SUPER_ADMIN'), deleteOfficer);

export default router;
