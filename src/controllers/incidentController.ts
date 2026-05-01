import { Response } from 'express';
import { Op } from 'sequelize';
import { Incident, User, Institution, EmergencyContact, sequelize } from '../models';
import { AuthRequest } from '../middleware/auth';
import { emitToInstitution, emitToUser } from '../lib/socket';
import { sendEmail } from '../lib/email';
import { sendSMS } from '../lib/sms';

export const createIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, type, priority, lat, lng, isAnonymous, locationName } = req.body;
    
    // Use user's institution from token if logged in, otherwise expect it in body (anonymous)
    const institutionId = req.user?.institutionId || req.body.institutionId;

    if (!institutionId) {
      return res.status(400).json({ message: 'Institution ID is required' });
    }

    const incident = await Incident.create({
      title,
      description,
      type,
      priority,
      location_name: locationName,
      location_lat: lat,
      location_lng: lng,
      is_anonymous: isAnonymous || false,
      reporter_id: isAnonymous ? null : req.user?.id,
      institution_id: institutionId,
      status: 'PENDING'
    });

    // Emit live alert to the institution's security room
    emitToInstitution(institutionId, 'new-incident', incident);

    // For high priority incidents, send email notifications
    if (priority === 'HIGH' || priority === 'CRITICAL') {
      try {
        const securityPersonnel = await User.findAll({
          where: {
            institution_id: institutionId,
            role: 'SECURITY',
            status: 'ACTIVE'
          },
          attributes: ['email']
        });

        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
        
        await Promise.all(securityPersonnel.map(person => 
          sendEmail({
            to: person.email,
            subject: `High Priority Incident: ${title}`,
            title: 'Action Required: High Priority Incident',
            message: `A <strong>${priority}</strong> priority incident has been reported: <strong>${title}</strong>.<br><br><strong>Location:</strong> ${locationName || 'Unspecified'}<br><strong>Description:</strong> ${description}`,
            actionText: 'View in Dashboard',
            actionUrl: `${FRONTEND_URL}/security/dashboard`
          }).catch(err => console.error(`Failed to send incident email to ${person.email}:`, err))
        ));
      } catch (error) {
        console.error('Failed to process high-priority incident notifications:', error);
      }
    }

    res.status(201).json(incident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createSOSIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, locationName } = req.body;
    const institutionId = req.user?.institutionId;

    if (!institutionId) {
      return res.status(400).json({ message: 'Institution ID is required' });
    }

    const user = req.user ? await User.findByPk(req.user.id) : null;
    const reporterName = user ? `${user.first_name} ${user.last_name}` : 'Anonymous User';

    const incident = await Incident.create({
      title: 'EMERGENCY SOS',
      description: `SOS Triggered by ${reporterName}. Immediate assistance required.`,
      type: 'emergency',
      priority: 'CRITICAL',
      location_name: locationName || 'Unknown Location',
      location_lat: lat,
      location_lng: lng,
      is_anonymous: false,
      reporter_id: req.user?.id,
      institution_id: institutionId,
      status: 'PENDING'
    });

    // Emit specialized SOS alert
    emitToInstitution(institutionId, 'sos-alert', {
      ...incident.toJSON(),
      reporter_name: reporterName
    });

    // Notify all active security personnel and Emergency Contacts
    try {
      const securityPersonnel = await User.findAll({
        where: {
          institution_id: institutionId,
          role: 'SECURITY',
          status: 'ACTIVE'
        },
        attributes: ['email']
      });

      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      // Send security emails
      await Promise.all(securityPersonnel.map(person => 
        sendEmail({
          to: person.email,
          subject: 'EMERGENCY SOS ALERT',
          title: 'Immediate Assistance Required',
          message: `An SOS alert has been triggered by <strong>${reporterName}</strong> at <strong>${locationName || 'Unknown Location'}</strong>.<br><br>Please check the security dashboard immediately.`,
          actionText: 'Open Security Dashboard',
          actionUrl: `${FRONTEND_URL}/security/dashboard`
        }).catch(err => console.error(`Failed to send SOS email to ${person.email}:`, err))
      ));

      // Notify Emergency Contacts
      if (req.user?.id) {
        const contacts = await EmergencyContact.findAll({
          where: { user_id: req.user.id }
        });

        if (contacts.length > 0) {
          await Promise.all(contacts.map(contact => 
            sendSMS(
              contact.phone,
              `URGENT SOS: ${reporterName} requires immediate assistance at ${locationName || 'Unknown Location'}. View: ${FRONTEND_URL}/map?incident=${incident.id}`
            ).catch(err => console.error(`Failed to send SMS to ${contact.name}:`, err))
          ));
        }
      }
    } catch (error) {
      console.error('Failed to process SOS notifications:', error);
    }

    res.status(201).json(incident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyIncidents = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId;
    const { status, priority, search } = req.query;
    const pageNum = Math.max(1, parseInt(req.query.page as string) || 1);
    const limitNum = Math.max(1, parseInt(req.query.limit as string) || 10);
    const offset = (pageNum - 1) * limitNum;
    const { Op } = require('sequelize');

    const andConditions: any[] = [{ institution_id: institutionId }];

    // Role-based visibility
    if (req.user?.role === 'STUDENT') {
      andConditions.push({ reporter_id: req.user.id });
    } else if (req.user?.role === 'SECURITY') {
      andConditions.push({
        [Op.or]: [
          { assignee_id: req.user.id },
          { status: 'PENDING' }
        ]
      });
    }

    // Status filtering
    if (status && status.toString().toLowerCase() !== 'all') {
      let mappedStatus = status.toString().toUpperCase();
      if (status.toString().toLowerCase() === 'active') mappedStatus = 'PENDING';
      else if (status.toString().toLowerCase() === 'in-progress') mappedStatus = 'INVESTIGATING';
      andConditions.push({ status: mappedStatus });
    }

    // Priority filtering
    if (priority && priority.toString().toUpperCase() !== 'ALL') {
      andConditions.push({ priority: priority.toString().toUpperCase() });
    }

    // Search functionality
    if (search) {
      andConditions.push({
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { location_name: { [Op.like]: `%${search}%` } }
        ]
      });
    }

    const { count, rows } = await Incident.findAndCountAll({
      where: { [Op.and]: andConditions },
      include: [
        { model: User, as: 'reporter', attributes: ['first_name', 'last_name'] },
        { model: User, as: 'assignee', attributes: ['first_name', 'last_name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset: offset
    });

    res.json({
      incidents: rows,
      total: count,
      pages: Math.ceil(count / limitNum),
      currentPage: pageNum
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateIncidentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const incident = await Incident.findByPk(id as string);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check if user belongs to the same institution
    if (incident.institution_id !== req.user?.institutionId && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    incident.status = status;
    await incident.save();

    // Notify the reporter and everyone in the institution
    emitToInstitution(incident.institution_id, 'notification', {
      type: 'INCIDENT_UPDATE',
      title: 'Incident Status Updated',
      message: `Incident #${incident.id.slice(0, 8)} status changed to ${status}.`,
      data: { incidentId: incident.id, status }
    });

    if (incident.reporter_id) {
      emitToUser(incident.reporter_id, 'notification', {
        type: 'INCIDENT_UPDATE',
        title: 'Your Report was Updated',
        message: `The status of your report "${incident.title}" is now ${status}.`,
        data: { incidentId: incident.id, status }
      });
    }

    res.json(incident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateIncidentLocation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { lat, lng, locationName } = req.body;

    const incident = await Incident.findByPk(id as string);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    if (incident.institution_id !== req.user?.institutionId && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    incident.location_lat = lat;
    incident.location_lng = lng;
    incident.location_name = locationName;
    await incident.save();

    // Notify about location update
    emitToInstitution(incident.institution_id, 'notification', {
      type: 'INCIDENT_LOCATION_UPDATE',
      title: 'Incident Location Updated',
      message: `The location for incident #${incident.id.slice(0, 8)} has been updated.`,
      data: { incidentId: incident.id, lat, lng }
    });

    res.json(incident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateIncidentRemarks = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const incident = await Incident.findByPk(id as string);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    if (incident.institution_id !== req.user?.institutionId && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only assignee or admins can add remarks
    if (incident.assignee_id !== req.user?.id && !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(req.user?.role as string)) {
      return res.status(403).json({ message: 'Only the assigned officer or an admin can update remarks' });
    }

    incident.remarks = remarks;
    await incident.save();

    // Notify reporter about new remarks if they exist
    if (incident.reporter_id) {
       emitToUser(incident.reporter_id, 'notification', {
        type: 'INCIDENT_REMARK',
        title: 'New Update on your Report',
        message: `An officer added a remark to your incident report: "${remarks.slice(0, 50)}..."`,
        data: { incidentId: incident.id }
      });
    }

    res.json(incident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const assignIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assignee_id } = req.body;

    const incident = await Incident.findByPk(id as string);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    if (incident.institution_id !== req.user?.institutionId && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    incident.assignee_id = assignee_id;
    // If assigned, move to INVESTIGATING if it was PENDING
    if (assignee_id) {
      incident.assigned_at = new Date();
      if (incident.status === 'PENDING') {
        incident.status = 'INVESTIGATING';
      }

      // Notify the officer
      emitToUser(assignee_id, 'notification', {
        type: 'INCIDENT_ASSIGNED',
        title: 'New Incident Assigned',
        message: `You have been assigned to incident #${incident.id.slice(0, 8)}.`,
        data: { incidentId: incident.id }
      });

      // Notify the institution (admins)
      emitToInstitution(incident.institution_id, 'notification', {
        type: 'INCIDENT_ASSIGNED',
        title: 'Incident Assigned',
        message: `Incident #${incident.id.slice(0, 8)} assigned to a security officer.`,
        data: { incidentId: incident.id }
      });
    }
    await incident.save();

    const updatedIncident = await Incident.findByPk(id as string, {
      include: [
        { model: User, as: 'assignee', attributes: ['email', 'first_name', 'last_name'] }
      ]
    });

    // Send notification email to assignee
    if (updatedIncident?.assignee?.email) {
      try {
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
        await sendEmail({
          to: updatedIncident.assignee.email,
          subject: `New Incident Assignment: ${updatedIncident.title}`,
          title: 'You have been assigned to an incident',
          message: `Incident <strong>#${updatedIncident.id}</strong> has been assigned to you.<br><br><strong>Type:</strong> ${updatedIncident.type}<br><strong>Priority:</strong> ${updatedIncident.priority}<br><strong>Description:</strong> ${updatedIncident.description}`,
          actionText: 'View Incident',
          actionUrl: `${FRONTEND_URL}/security/dashboard`
        });
      } catch (emailError) {
        console.error('Failed to send assignment email:', emailError);
      }
    }

    res.json(updatedIncident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getIncidentStats = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId;
    
    const activeCount = await Incident.count({ where: { institution_id: institutionId, status: ['PENDING', 'INVESTIGATING'] } });
    const resolvedToday = await Incident.count({ 
      where: { 
        institution_id: institutionId, 
        status: 'RESOLVED',
        updated_at: { [require('sequelize').Op.gte]: new Date().setHours(0, 0, 0, 0) }
      } 
    });

    const officersOnDuty = await User.count({ 
      where: { 
        institution_id: institutionId, 
        role: 'SECURITY',
        status: 'ACTIVE'
      } 
    });

    const safetyScore = Math.max(0, 100 - (activeCount * 5));
    let safetyMessage = "Your campus is currently stable and secure.";
    if (safetyScore < 70) safetyMessage = "High volume of active reports. Avoid isolated areas.";
    else if (safetyScore < 90) safetyMessage = "Multiple active incidents. Stay alert and report suspicious activity.";

    const { Op, fn, col, literal } = require('sequelize');
    const now = new Date();
    const todayStart = new Date(new Date().setHours(0,0,0,0));
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const incidentsToday = (await Incident.count({ where: { institution_id: institutionId, created_at: { [Op.gte]: todayStart } } })) || 0;
    const incidentsYesterday = (await Incident.count({ where: { institution_id: institutionId, created_at: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart } } })) || 0;

    const incidentChangePercent = incidentsYesterday > 0 
      ? ((incidentsToday - incidentsYesterday) / incidentsYesterday * 100).toFixed(1) 
      : (incidentsToday > 0 ? "100.0" : "0.0");

    const resolvedTodayCount = resolvedToday || 0;
    const resolvedYesterdayCount = (await Incident.count({ 
      where: { 
        institution_id: institutionId, 
        status: 'RESOLVED',
        updated_at: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart }
      } 
    })) || 0;

    const resolvedChangePercent = resolvedYesterdayCount > 0 
      ? ((resolvedTodayCount - resolvedYesterdayCount) / resolvedYesterdayCount * 100).toFixed(1) 
      : (resolvedTodayCount > 0 ? "100.0" : "0.0");

    const totalOfficers = (await User.count({ where: { institution_id: institutionId, role: 'SECURITY' } })) || 0;
    const totalStudents = (await User.count({ where: { institution_id: institutionId, role: 'STUDENT' } })) || 0;
    
    const newOfficersToday = (await User.count({ where: { institution_id: institutionId, role: 'SECURITY', created_at: { [Op.gte]: todayStart } } })) || 0;
    const newStudentsToday = (await User.count({ where: { institution_id: institutionId, role: 'STUDENT', created_at: { [Op.gte]: todayStart } } })) || 0;

    const officersYesterday = Math.max(0, totalOfficers - newOfficersToday);
    const studentsYesterday = Math.max(0, totalStudents - newStudentsToday);

    const personnelChangePercent = officersYesterday > 0 ? (newOfficersToday / officersYesterday * 100).toFixed(1) : (newOfficersToday > 0 ? "100.0" : "0.0");
    const studentChangePercent = studentsYesterday > 0 ? (newStudentsToday / studentsYesterday * 100).toFixed(1) : (newStudentsToday > 0 ? "100.0" : "0.0");

    const isPostgres = sequelize.getDialect() === 'postgres';
    const timeDiffSql = isPostgres 
      ? 'EXTRACT(EPOCH FROM (assigned_at - created_at))'
      : "strftime('%s', assigned_at) - strftime('%s', created_at)";

    const assignedIncidents = await Incident.findAll({
      where: { 
        institution_id: institutionId,
        assigned_at: { [Op.ne]: null }
      },
      attributes: [
        [fn('AVG', literal(timeDiffSql)), 'avgResponse']
      ],
      raw: true
    });
    const avgSeconds = Math.round((assignedIncidents[0] as any).avgResponse || 0);
    const avgResponseTime = avgSeconds > 0 ? `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s` : "0s";

    
    // Calculate duty change (e.g., active officers vs total security personnel or a fixed baseline)
    const dutyChangePercent = totalOfficers > 0 
      ? Math.round((officersOnDuty / totalOfficers) * 100) 
      : 0;

    res.json({
      activeIncidents: activeCount,
      activeChange: `${parseFloat(incidentChangePercent) >= 0 ? '+' : ''}${incidentChangePercent}%`,
      resolvedToday: resolvedToday,
      resolvedChange: `${parseFloat(resolvedChangePercent) >= 0 ? '+' : ''}${resolvedChangePercent}%`,
      avgResponseTime,
      avgResponseChange: "-0.0%",
      officersOnDuty,
      dutyChange: `+${dutyChangePercent}%`,
      totalOfficers,
      personnelChange: `${parseFloat(personnelChangePercent) >= 0 ? '+' : ''}${personnelChangePercent}%`,
      totalStudents,
      studentChange: `${parseFloat(studentChangePercent) >= 0 ? '+' : ''}${studentChangePercent}%`,
      safetyScore,
      safetyMessage,
      safetyTip: 'Walking at night? Use the "Share Location" feature with a trusted friend in the app.'
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const institutionId = req.user?.institutionId;
    const { Op, fn, col, literal } = require('sequelize');
    const now = new Date();

    // 1. Status Breakdown
    const rawStatus = await Incident.findAll({
      where: { institution_id: institutionId },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status']
    });
    const statusBreakdown = rawStatus.map((s: any) => ({
      status: s.get('status'),
      count: parseInt(s.get('count')) || 0
    }));

    // 2. Type Breakdown
    const rawType = await Incident.findAll({
      where: { institution_id: institutionId },
      attributes: ['type', [fn('COUNT', col('id')), 'count']],
      group: ['type'],
      order: [[fn('COUNT', col('id')), 'DESC']]
    });
    const typeBreakdown = rawType.map((t: any) => ({
      type: t.get('type'),
      count: parseInt(t.get('count')) || 0
    }));

    // 3. Weekly Trend (Last 7 Days)
    const trend = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      
      const dayIncidents = await Incident.count({
        where: {
          institution_id: institutionId,
          created_at: { [Op.between]: [startOfDay, endOfDay] }
        }
      });
      
      const dayResolved = await Incident.count({
        where: {
          institution_id: institutionId,
          status: 'RESOLVED',
          updated_at: { [Op.between]: [startOfDay, endOfDay] }
        }
      });
      
      trend.push({
        day: dayNames[startOfDay.getDay()],
        incidents: dayIncidents,
        resolved: dayResolved
      });
    }

    // 4. Summary Stats & Growth
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const incidentsThisWeek = await Incident.count({ where: { institution_id: institutionId, created_at: { [Op.gte]: oneWeekAgo } } });
    const incidentsLastWeek = await Incident.count({ where: { institution_id: institutionId, created_at: { [Op.between]: [twoWeeksAgo, oneWeekAgo] } } });
    
    const totalIncidents = await Incident.count({ where: { institution_id: institutionId } });
    const totalResolved = await Incident.count({ where: { institution_id: institutionId, status: 'RESOLVED' } });
    const resolutionRate = totalIncidents > 0 ? Math.round((totalResolved / totalIncidents) * 100) : 0;

    const incidentChange = incidentsLastWeek > 0 
      ? ((incidentsThisWeek - incidentsLastWeek) / incidentsLastWeek * 100).toFixed(1) 
      : (incidentsThisWeek > 0 ? "100.0" : "0.0");

    const isPostgres = sequelize.getDialect() === 'postgres';
    const timeDiffSql = isPostgres 
      ? 'EXTRACT(EPOCH FROM (assigned_at - created_at))'
      : "strftime('%s', assigned_at) - strftime('%s', created_at)";

    const assignedIncidents = await Incident.findAll({
      where: { 
        institution_id: institutionId,
        assigned_at: { [Op.ne]: null }
      },
      attributes: [
        [fn('AVG', literal(timeDiffSql)), 'avgResponse']
      ],
      raw: true
    });

    const avgSeconds = Math.round((assignedIncidents[0] as any).avgResponse || 0);
    const avgResponseTime = avgSeconds > 0 
      ? `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s` 
      : "0s";

    res.json({
      totalIncidents,
      resolutionRate: `${resolutionRate}%`,
      incidentChange: `${parseFloat(incidentChange) >= 0 ? '+' : ''}${incidentChange}%`,
      resRateChange: "+0.0%",
      avgResponseTime,
      avgResponseChange: "-2.1%", // Simplified for now
      statusBreakdown,
      typeBreakdown,
      trend
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getStudentReports = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const reports = await Incident.findAll({
      where: { reporter_id: userId },
      include: [
        { model: User, as: 'assignee', attributes: ['first_name', 'last_name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
