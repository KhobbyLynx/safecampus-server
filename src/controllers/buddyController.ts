import { Response } from 'express';
import { Buddy, User } from '../models';
import { AuthRequest } from '../middleware/auth';
import { Op } from 'sequelize';
import { emitToUser, emitToInstitution } from '../lib/socket';

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
          attributes: ['id', 'first_name', 'last_name', 'email', 'last_lat', 'last_lng'] 
        },
        {
          model: User,
          as: 'requester_info',
          attributes: ['id', 'first_name', 'last_name', 'email', 'last_lat', 'last_lng']
        }
      ],
      attributes: ['id', 'user_id', 'buddy_id', 'status', 'user_is_sharing', 'buddy_is_sharing', 'updated_at', 'created_at']
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
    const user = await User.findByPk(userId);

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

    // Notify the receiver
    emitToUser(buddyUser.id, 'notification', {
      type: 'BUDDY_REQUEST',
      title: 'New Buddy Request',
      message: `${user?.first_name} ${user?.last_name} sent you a buddy request.`,
      data: { buddyId: buddy.id, requesterId: userId }
    });

    // Notify Admins for tracking action (optional but requested)
    if (user?.institution_id) {
      emitToInstitution(user.institution_id, 'admin-activity', {
        type: 'BUDDY',
        message: `Student ${user.first_name} sent a buddy request to ${buddyUser.first_name}`
      });
    }

    res.status(201).json(buddy);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBuddyStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isSharing } = req.body;
    const currentUserId = req.user?.id;

    const buddy = await Buddy.findByPk(id as string, {
      include: [
        { model: User, as: 'requester_info', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'buddy_info', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });

    if (!buddy) {
      return res.status(404).json({ message: 'Buddy not found' });
    }

    if (buddy.user_id !== currentUserId && buddy.buddy_id !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only recipient can accept a pending request
    if (status === 'ACCEPTED' && buddy.status === 'PENDING' && buddy.buddy_id !== currentUserId) {
      return res.status(403).json({ message: 'Only the recipient can accept this request' });
    }

    const oldStatus = buddy.status;
    if (status) buddy.status = status;
    
    let sharingToggled = false;
    let oldIsSharing = false;
    if (typeof isSharing === 'boolean') {
      sharingToggled = true;
      if (buddy.user_id === currentUserId) {
        oldIsSharing = buddy.user_is_sharing;
        buddy.user_is_sharing = isSharing;
      } else if (buddy.buddy_id === currentUserId) {
        oldIsSharing = buddy.buddy_is_sharing;
        buddy.buddy_is_sharing = isSharing;
      }
    }
    
    await buddy.save();

    // Determine who to notify
    const otherUserId = buddy.user_id === currentUserId ? buddy.buddy_id : buddy.user_id;
    const currentUser = buddy.user_id === currentUserId ? buddy.requester_info : buddy.buddy_info;
    const otherUser = buddy.user_id === currentUserId ? buddy.buddy_info : buddy.requester_info;

    if (status === 'ACCEPTED' && oldStatus === 'PENDING') {
      emitToUser(otherUserId, 'notification', {
        type: 'BUDDY_ACCEPTED',
        title: 'Buddy Request Accepted',
        message: `${currentUser?.first_name} accepted your buddy request!`,
        data: { buddyId: buddy.id }
      });
    }
    
    if (sharingToggled) {
      if (isSharing && !oldIsSharing) {
        emitToUser(otherUserId, 'notification', {
          type: 'BUDDY_SHARING',
          title: 'Buddy Sharing Location',
          message: `${currentUser?.first_name} is now sharing their live location with you.`,
          data: { buddyId: buddy.id, userId: currentUserId }
        });
      } else if (!isSharing && oldIsSharing) {
        emitToUser(otherUserId, 'notification', {
          type: 'BUDDY_STOPPED_SHARING',
          title: 'Buddy Stopped Sharing',
          message: `${currentUser?.first_name} stopped sharing their live location.`,
          data: { buddyId: buddy.id }
        });
      }
    }

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
