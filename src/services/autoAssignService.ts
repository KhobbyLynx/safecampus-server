import { Op } from 'sequelize';
import { Incident, User } from '../models';
import { emitToInstitution } from '../lib/socket';
import { sendEmail } from '../lib/email';

export const startAutoAssignWorker = () => {
  // Run every 30 seconds
  setInterval(async () => {
    try {
      // Find all pending incidents that are unassigned
      const unassignedIncidents = await Incident.findAll({
        where: {
          status: 'PENDING',
          assignee_id: null
        }
      });

      if (unassignedIncidents.length === 0) return;

      const now = new Date();

      for (const incident of unassignedIncidents) {
        const createdAt = new Date(incident.created_at);
        const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

        let shouldAutoAssign = false;

        // SLAs: 1 min for CRITICAL/HIGH, 5 min for MEDIUM, 10 min for LOW
        if ((incident.priority === 'CRITICAL' || incident.priority === 'HIGH') && elapsedMinutes >= 1) {
          shouldAutoAssign = true;
        } else if (incident.priority === 'MEDIUM' && elapsedMinutes >= 5) {
          shouldAutoAssign = true;
        } else if (incident.priority === 'LOW' && elapsedMinutes >= 10) {
          shouldAutoAssign = true;
        }

        if (shouldAutoAssign) {
          // Find active security personnel in the same institution
          const availableOfficers = await User.findAll({
            where: {
              institution_id: incident.institution_id,
              role: 'SECURITY',
              status: 'ACTIVE'
            }
          });

          if (availableOfficers.length > 0) {
            // Pick a random officer (or could do round-robin / least loaded)
            const officer = availableOfficers[Math.floor(Math.random() * availableOfficers.length)];

            // Assign the incident
            incident.assignee_id = officer.id;
            incident.assigned_at = new Date();
            incident.status = 'INVESTIGATING';
            await incident.save();

            console.log(`[Auto-Assign] Assigned incident #${incident.id} to officer ${officer.id}`);

            // Fetch the updated incident with relations for broadcasting
            const updatedIncident = await Incident.findByPk(incident.id, {
              include: [
                { model: User, as: 'assignee', attributes: ['email', 'first_name', 'last_name'] },
                { model: User, as: 'reporter', attributes: ['first_name', 'last_name'] }
              ]
            });

            // Emit socket updates globally and to institution
            emitToInstitution(incident.institution_id, 'incident-updated', updatedIncident);

            // Send notification email
            const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
            try {
              await sendEmail({
                to: officer.email,
                subject: `AUTO-DISPATCH: High Priority Incident Assigned`,
                title: 'You have been auto-assigned to an incident',
                message: `Incident <strong>#${updatedIncident?.id?.slice(0, 8)}</strong> has been automatically dispatched to you due to SLA escalation rules.<br><br><strong>Type:</strong> ${updatedIncident?.type}<br><strong>Priority:</strong> ${updatedIncident?.priority}<br><strong>Location:</strong> ${updatedIncident?.location_name || 'Campus'}<br><br>Please respond immediately.`,
                actionText: 'Open Incident Command',
                actionUrl: `${FRONTEND_URL}/security/dashboard`
              });
            } catch (emailErr) {
              console.error(`Failed to send auto-assign email to ${officer.email}:`, emailErr);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Auto-Assign Worker] Error checking incidents:', error);
    }
  }, 30 * 1000); // 30 seconds
};
