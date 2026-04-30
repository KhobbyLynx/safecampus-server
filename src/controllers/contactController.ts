import { Response } from 'express';
import { EmergencyContact } from '../models';
import { AuthRequest } from '../middleware/auth';

export const getMyContacts = async (req: AuthRequest, res: Response) => {
  try {
    const contacts = await EmergencyContact.findAll({
      where: { user_id: req.user?.id }
    });
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addContact = async (req: AuthRequest, res: Response) => {
  try {
    const { name, relationship, phone, isPrimary } = req.body;
    const userId = req.user?.id;

    if (isPrimary) {
      // Unset existing primary contact
      await EmergencyContact.update(
        { is_primary: false },
        { where: { user_id: userId, is_primary: true } }
      );
    }

    const contact = await EmergencyContact.create({
      user_id: userId,
      name,
      relationship,
      phone,
      is_primary: isPrimary || false
    });

    res.status(201).json(contact);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteContact = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await EmergencyContact.findByPk(id as string);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (contact.user_id !== req.user?.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await contact.destroy();
    res.json({ message: 'Contact removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
