import { Router } from 'express';
import { getMyContacts, addContact, deleteContact } from '../controllers/contactController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getMyContacts);
router.post('/', authenticate, addContact);
router.delete('/:id', authenticate, deleteContact);

export default router;
