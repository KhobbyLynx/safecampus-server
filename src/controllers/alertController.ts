import { Response } from 'express';
import { Alert } from '../models';
import { AuthRequest } from '../middleware/auth';
import { emitToInstitution } from '../lib/socket';

export const getAllAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId;
    const alerts = await Alert.findAll({
      where: { institution_id: institutionId },
      order: [['created_at', 'DESC']]
    });
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createAlert = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, type, location, expires_in_hours } = req.body;
    const institutionId = req.user?.institutionId;

    let expiresAt = null;
    if (expires_in_hours && !isNaN(expires_in_hours)) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expires_in_hours));
    }

    const alert = await Alert.create({
      institution_id: institutionId,
      title,
      description,
      type,
      location,
      expires_at: expiresAt
    });

    // Broadcast to everyone in the institution
    emitToInstitution(institutionId, 'notification', {
      type: 'ALERT',
      title: title,
      message: description || 'New campus alert issued.',
      data: { alertId: alert.id }
    });

    res.status(201).json(alert);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
