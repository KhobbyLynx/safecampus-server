import { Response } from 'express';
import { Buddy, User } from '../models';
import { AuthRequest } from '../middleware/auth';
import { Op } from 'sequelize';

export const getMyBuddies = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const buddies = await Buddy.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { buddy_id: userId }
        ]
      },
      include: [
        { 
          model: User, 
          as: 'buddy_info', 
          attributes: ['id', 'first_name', 'last_name', 'email'] 
        },
        {
          model: User,
          as: 'requester_info',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });
    res.json(buddies);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addBuddy = async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    const userId = req.user?.id;

    const buddyUser = await User.findOne({ where: { email } });
    if (!buddyUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (buddyUser.id === userId) {
      return res.status(400).json({ message: 'You cannot add yourself as a buddy' });
    }

    const existing = await Buddy.findOne({
      where: { user_id: userId, buddy_id: buddyUser.id }
    });

    if (existing) {
      return res.status(400).json({ message: 'Buddy relationship already exists' });
    }

    const buddy = await Buddy.create({
      user_id: userId,
      buddy_id: buddyUser.id,
      status: 'PENDING'
    });

    res.status(201).json(buddy);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBuddyStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const buddy = await Buddy.findByPk(id as string);
    if (!buddy) {
      return res.status(404).json({ message: 'Buddy not found' });
    }

    if (buddy.user_id !== req.user?.id && buddy.buddy_id !== req.user?.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only recipient can accept a pending request
    if (status === 'ACCEPTED' && buddy.status === 'PENDING' && buddy.buddy_id !== req.user?.id) {
      return res.status(403).json({ message: 'Only the recipient can accept this request' });
    }

    // Only requester can start/stop sharing (or both? let's say both for now but usually the one sharing toggles it)
    // Actually the UI allows toggling "Sharing...". Let's assume the person who clicks the button is the one sharing.

    buddy.status = status;
    await buddy.save();

    res.json(buddy);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const removeBuddy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const buddy = await Buddy.findByPk(id as string);
    
    if (!buddy) {
      return res.status(404).json({ message: 'Buddy not found' });
    }

    if (buddy.user_id !== req.user?.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await buddy.destroy();
    res.json({ message: 'Buddy removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
