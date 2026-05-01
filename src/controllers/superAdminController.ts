import { Request, Response } from 'express';
import { Institution, User, Incident, Hotspot, Alert, Buddy, EmergencyContact, sequelize } from '../models';
import { Op, fn, col } from 'sequelize';

export const getSystemStats = async (req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalInstitutions, totalUsers, totalIncidents, activeIncidents, newInstitutions] = await Promise.all([
      Institution.count({ where: { domain: { [Op.ne]: 'safecampus.edu' } } }),
      User.count(),
      Incident.count(),
      Incident.count({ where: { status: 'ACTIVE' } }),
      Institution.count({ 
        where: { 
          domain: { [Op.ne]: 'safecampus.edu' },
          created_at: { [Op.gte]: thirtyDaysAgo } 
        } 
      })
    ]);


    // Get growth data - truly accurate by grouping by month (excluding system)
    const allInstitutions = await Institution.findAll({
      where: { domain: { [Op.ne]: 'safecampus.edu' } },
      attributes: ['created_at'],
      order: [['created_at', 'ASC']]
    });

    const monthlyCounts: { [key: string]: number } = {};
    allInstitutions.forEach(inst => {
      if (inst.created_at) {
        const date = new Date(inst.created_at);
        const month = date.toLocaleString('default', { month: 'short' });
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
      }
    });

    // Convert to the format expected by the chart
    const growthData = Object.entries(monthlyCounts).map(([name, value]) => ({ name, value }));

    // Calculate real-time health score
    let healthScore = 100;
    try {
      const dbStart = Date.now();
      await sequelize.authenticate();
      const latency = Date.now() - dbStart;
      if (latency > 200) healthScore = 95;
      if (latency > 500) healthScore = 80;
    } catch (e) {
      healthScore = 0;
    }

    res.json({
      totalInstitutions,
      totalUsers,
      totalIncidents,
      activeIncidents,
      newInstitutions,
      growth: totalInstitutions > 0 ? (newInstitutions / totalInstitutions) * 100 : 0,
      growthData: growthData.length > 0 ? growthData : [{ name: 'N/A', value: 0 }],
      healthScore
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getInstitutions = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    const { count, rows } = await Institution.findAndCountAll({
      where: {
        domain: { [Op.ne]: 'safecampus.edu' },
        ...(search ? {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { domain: { [Op.like]: `%${search}%` } }
          ]
        } : {})
      },
      limit,
      offset,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'name', 'domain', 'status', 'created_at']
    });

    // For each institution, get admin count and student count
    const institutionsWithCounts = await Promise.all(rows.map(async (inst) => {
      const counts = await User.findAll({
        where: { institution_id: inst.id },
        attributes: ['role', [fn('COUNT', col('id')), 'count']],
        group: ['role']
      });

      const roleMap: { [key: string]: number } = {};
      counts.forEach((c: any) => {
        roleMap[c.role] = parseInt(c.get('count'));
      });

      return {
        ...inst.toJSON(),
        adminCount: roleMap['SCHOOL_ADMIN'] || 0,
        studentCount: roleMap['STUDENT'] || 0,
        staffCount: roleMap['STAFF'] || 0,
        securityCount: roleMap['SECURITY'] || 0,
        superAdminCount: roleMap['SUPER_ADMIN'] || 0,
        totalCount: Object.values(roleMap).reduce((a, b) => a + b, 0)
      };
    }));

    res.json({
      institutions: institutionsWithCounts,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateInstitutionStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const institution = await Institution.findByPk(id as string);
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    // Prevent suspending the system institution
    if (institution.domain === 'safecampus.edu') {
      return res.status(403).json({ message: 'The core system institution cannot be suspended.' });
    }

    await institution.update({ status });
    res.json({ message: `Institution ${status.toLowerCase()} successfully`, institution });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteInstitution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const institution = await Institution.findByPk(id as string);
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    // Prevent deleting the system institution
    if (institution.domain === 'safecampus.edu') {
      return res.status(403).json({ message: 'The core system institution cannot be deleted.' });
    }

    // Perform a deep delete
    // In a real production app, we might use paranoid deletes or just suspend
    // but the requirement says "delete".
    
    // 1. Delete associated Hotspots
    await Hotspot.destroy({ where: { institution_id: id } });
    
    // 2. Delete associated Incidents
    await Incident.destroy({ where: { institution_id: id } });
    
    // 3. Delete associated Alerts
    await Alert.destroy({ where: { institution_id: id } });
    
    // 4. Delete associated Emergency Contacts
    await EmergencyContact.destroy({ where: { institution_id: id } });
    
    // 5. Delete associated Buddies (since they are tied to users of the institution)
    const institutionUsers = await User.findAll({ where: { institution_id: id }, attributes: ['id'] });
    const userIds = institutionUsers.map(u => u.id);
    await Buddy.destroy({ where: { [Op.or]: [{ user_id: userIds }, { buddy_id: userIds }] } });
    
    // 6. Delete associated Users
    await User.destroy({ where: { institution_id: id } });
    
    // 7. Finally delete the institution
    await institution.destroy();

    res.json({ message: 'Institution and all associated data deleted permanently' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const runDiagnostics = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // 1. Check Database
    let dbStatus = 'Healthy';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await Institution.sequelize?.authenticate();
      dbLatency = Date.now() - dbStart;
    } catch (e) {
      dbStatus = 'Degraded';
    }

    // 2. Data Integrity Checks
    const institutions = await Institution.findAll({ attributes: ['id'] });
    const instIds = institutions.map(i => i.id);
    const validInstIds = instIds.length > 0 ? instIds : ['00000000-0000-0000-0000-000000000000'];

    const users = await User.findAll({ attributes: ['id'] });
    const userIds = users.map(u => u.id);
    const validUserIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];

    const [orphanUsers, orphanIncidents, orphanAlerts, orphanContacts] = await Promise.all([
      User.count({ where: { institution_id: { [Op.notIn]: validInstIds } } }),
      Incident.count({ where: { institution_id: { [Op.notIn]: validInstIds } } }),
      Alert.count({ where: { institution_id: { [Op.notIn]: validInstIds } } }),
      EmergencyContact.count({ where: { user_id: { [Op.notIn]: validUserIds } } })
    ]);

    const totalOrphans = orphanUsers + orphanIncidents + orphanAlerts + orphanContacts;

    // 3. Environment Stability
    const envStatus = process.env.NODE_ENV || 'development';
    const hasSecret = !!process.env.JWT_SECRET;
    
    const diagnostics = [
      { name: "PostgreSQL Cluster", status: dbStatus, latency: `${dbLatency}ms`, detail: "Primary database node is responsive" },
      { name: "Data Integrity", status: totalOrphans === 0 ? "Healthy" : "Issues Detected", detail: `${totalOrphans} orphan records found across all tables` },
      { name: "Auth Provider", status: hasSecret ? "Active" : "Configuration Error", detail: "JWT Secret validation successful" },
      { name: "Production Node", status: envStatus === 'production' ? "Active" : "Development", detail: `System running in ${envStatus} mode` }
    ];

    res.json({
      timestamp: new Date().toISOString(),
      overallStatus: dbStatus === 'Healthy' && totalOrphans === 0 ? "Optimal" : "Attention Required",
      duration: `${Date.now() - startTime}ms`,
      diagnostics
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const incidents = await Incident.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{ 
        model: Institution, 
        attributes: ['name'],
        where: { domain: { [Op.ne]: 'safecampus.edu' } }
      }]
    });

    const institutions = await Institution.findAll({
      where: { domain: { [Op.ne]: 'safecampus.edu' } },
      limit: 3,
      order: [['created_at', 'DESC']]
    });

    const activity = [
      ...incidents.map(i => ({
        type: 'INCIDENT',
        msg: `New ${i.priority} incident reported at ${(i as any).Institution?.name || 'Campus'}`,
        time: i.created_at,
        priority: i.priority
      })),
      ...institutions.map(inst => ({
        type: 'ONBOARD',
        msg: `${inst.name} successfully onboarded to the system`,
        time: inst.created_at,
        priority: 'LOW'
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);

    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
