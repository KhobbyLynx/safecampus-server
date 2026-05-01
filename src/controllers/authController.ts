import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Institution } from '../models';
import { sendEmail } from '../lib/email';
import { emitToInstitution } from '../lib/socket';
import { Op } from 'sequelize';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_me';

export const register = async (req: Request, res: Response) => {
  try {
    const { password, firstName, lastName, institutionId, role } = req.body;
    const email = req.body.email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if institution exists
    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
      return res.status(400).json({ message: 'Invalid institution' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      institution_id: institutionId,
      role: role || 'STUDENT',
    });

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const email = req.body.email.toLowerCase().trim();

    // Find user
    const user = await User.findOne({ where: { email }, include: [Institution] });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is deactivated
    if (user.getDataValue('status') === 'INACTIVE') {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact your administrator.' });
    }

    // Update status for pending security officers on first login
    if (user.role === 'SECURITY' && user.getDataValue('status') === 'PENDING') {
      await user.update({ status: 'ACTIVE' });
      emitToInstitution(user.institution_id, 'officer-activated', {
        id: user.id,
        status: 'ACTIVE'
      });
    }

    // Generate token
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        institutionId: user.institution_id 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Must be true for sameSite: 'none'
      sameSite: 'none', // Required for cross-domain (Vercel to Render)
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        institution: user.getDataValue('Institution'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ message: 'Logged out successfully' });
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email },
          { recovery_email: email }
        ]
      } 
    });
    
    if (!user) {
      // For security, don't reveal if user exists. Just say email sent.
      return res.json({ message: 'If an account exists with this email, a reset code has been sent.' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    await user.update({
      reset_token: resetCode,
      reset_token_expires: expires
    });

    try {
      await sendEmail({
        to: email,
        subject: 'Your SafeCampus Password Reset Code',
        title: 'Password Reset Request',
        message: `You requested a password reset. Your 6-digit verification code is: <h2 style="color: #3b82f6; letter-spacing: 4px; text-align: center;">${resetCode}</h2><br>This code will expire in 30 minutes.`,
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      // In a real app, you might return an error here, but for dev we can just log the code
      console.log('RESET CODE FOR DEV:', resetCode);
    }

    res.json({ message: 'Reset code sent successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email },
          { recovery_email: email }
        ],
        reset_token: code 
      } 
    });

    if (!user || !user.reset_token_expires || user.reset_token_expires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
