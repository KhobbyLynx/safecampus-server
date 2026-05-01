import { Response } from 'express';
import { User, Institution } from '../models';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { sendEmail } from '../lib/email';

export const getInstitutionOfficers = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId;
    if (!institutionId) {
      return res.status(400).json({ message: 'Institution ID not found in token' });
    }

    const officers = await User.findAll({
      where: {
        institution_id: institutionId,
        role: 'SECURITY'
      },
      attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'badge_number']
    });

    res.json(officers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createOfficer = async (req: AuthRequest, res: Response) => {
  try {
    const { email, firstName, lastName, badgeNumber } = req.body;
    const institutionId = req.user?.institutionId;
    const bcrypt = require('bcryptjs');

    // Check if user already exists
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create a pending security user
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const officer = await User.create({
      first_name: firstName || 'Security',
      last_name: lastName || 'Officer',
      email,
      password: hashedPassword,
      role: 'SECURITY',
      institution_id: institutionId,
      status: 'PENDING',
      badge_number: badgeNumber || `SC-${Math.floor(1000 + Math.random() * 9000)}`
    });

    // Send invitation email
    try {
      await sendEmail({
        to: email,
        subject: 'Invitation to Join SafeCampus Security Force',
        title: 'Welcome to SafeCampus',
        message: `You have been invited to join the SafeCampus security force. Your temporary password is: <strong>${tempPassword}</strong><br><br>Please click the button below to log in and set up your account.`,
        actionText: 'Log In to SafeCampus',
        actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
      });
    } catch (emailError: any) {
      console.error('Failed to send invite email:', emailError);
      return res.status(500).json({ 
        message: `User created but email failed: ${emailError.message}`
      });
    }

    res.status(201).json(officer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user?.id, {
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expires'] },
      include: [{ model: Institution }]
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, email, recovery_email, preferences } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const updateData: any = {
      first_name: firstName,
      last_name: lastName,
      preferences: preferences || user.preferences
    };

    // Only SUPER_ADMIN can change their primary email via this route
    if (email && user.role === 'SUPER_ADMIN') {
      // Check if email is already taken by another user
      const existing = await User.findOne({ where: { email } });
      if (existing && existing.id !== user.id) {
        return res.status(400).json({ message: 'Email is already in use by another account' });
      }
      updateData.email = email;
    }

    if (recovery_email !== undefined) {
      updateData.recovery_email = recovery_email;
    }
    
    await user.update(updateData);
    
    res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      institution_id: user.institution_id,
      recovery_email: user.recovery_email,
      preferences: user.preferences
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { preferences } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update({ preferences });
    res.json({ message: 'Preferences updated', preferences: user.preferences });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOfficerStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const institutionId = req.user?.institutionId;

    const officer = await User.findOne({ 
      where: { id, institution_id: institutionId, role: 'SECURITY' } 
    });

    if (!officer) {
      return res.status(404).json({ message: 'Officer not found' });
    }

    await officer.update({ status });
    res.json(officer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteOfficer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const institutionId = req.user?.institutionId;

    const officer = await User.findOne({ 
      where: { id, institution_id: institutionId, role: 'SECURITY' } 
    });

    if (!officer) {
      return res.status(404).json({ message: 'Officer not found' });
    }

    await officer.destroy();
    res.json({ message: 'Officer removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new passwords are required' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
