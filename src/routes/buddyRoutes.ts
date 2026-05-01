import { Router } from 'express';
import { getMyBuddies, addBuddy, updateBuddyStatus, removeBuddy } from '../controllers/buddyController';
import { authenticate } from '../middleware/auth';
import { emitToUser } from '../lib/socket';

const router = Router();

router.get('/', authenticate, getMyBuddies);
router.post('/', authenticate, addBuddy);
router.patch('/:id', authenticate, updateBuddyStatus);
router.delete('/:id', authenticate, removeBuddy);

// ── DEV ONLY: fire a test notification to any user room ──
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-notify/:userId', (req: any, res) => {
    const { userId } = req.params;
    emitToUser(userId, 'notification', {
      type: 'BUDDY_REQUEST',
      title: 'Test Notification',
      message: `This is a test notification for user ${userId}`,
      data: {}
    });
    console.log(`[debug]: Fired test notification to user-${userId}`);
    res.json({ ok: true, target: `user-${userId}` });
  });
}

export default router;