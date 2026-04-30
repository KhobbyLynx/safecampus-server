import { Router } from 'express';
import { getMyBuddies, addBuddy, updateBuddyStatus, removeBuddy } from '../controllers/buddyController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getMyBuddies);
router.post('/', authenticate, addBuddy);
router.patch('/:id', authenticate, updateBuddyStatus);
router.delete('/:id', authenticate, removeBuddy);

export default router;
