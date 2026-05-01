import { sequelize, Institution, User, Hotspot } from './models';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    try {
      await sequelize.sync({ alter: true });
    } catch (syncError) {
      console.warn('[seed]: Alter sync failed (common with SQLite schema changes). Attempting force sync...');
      await sequelize.sync({ force: true });
    }
    console.log('[seed]: Database synced');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // ─── University Of Ghana ──────────────────────────────────────────────────
    const [ug] = await Institution.findOrCreate({
      where: { domain: 'ug.edu.gh' },
      defaults: {
        name: 'University of Ghana',
        slug: 'ug-legon',
        boundary: [
          [5.642, -0.198], [5.665, -0.198], [5.665, -0.170], [5.642, -0.170], [5.642, -0.198]
        ],
        center_lat: 5.6505,
        center_lng: -0.1870,
        zoom_level: 15
      }
    });

    // UG Landmarks
    const ugLandmarks = [
      { label: 'Balme Library', zone: 'Central', lat: 5.6517, lng: -0.1866, intensity: 'landmark', types: 'Library, Study Area' },
      { label: 'Legon Hall', zone: 'Residential', lat: 5.6530, lng: -0.1840, intensity: 'low', types: 'Hostel' },
      { label: 'Night Market', zone: 'Social', lat: 5.6480, lng: -0.1890, intensity: 'medium', types: 'Food, Market' },
      { label: 'Security Post (Main Gate)', zone: 'Security', lat: 5.6425, lng: -0.1875, intensity: 'landmark', types: 'Security, Gate' }
    ];

    for (const lm of ugLandmarks) {
      await Hotspot.findOrCreate({
        where: { institution_id: ug.id, label: lm.label },
        defaults: { ...lm, institution_id: ug.id }
      });
    }

    await User.findOrCreate({
      where: { email: 'admin@ug.edu.gh' },
      defaults: {
        first_name: 'UG',
        last_name: 'Admin',
        password: hashedPassword,
        role: 'SCHOOL_ADMIN',
        institution_id: ug.id,
        status: 'ACTIVE'
      }
    });


    await User.findOrCreate({
      where: { email: 'student@ug.edu.gh' },
      defaults: {
        first_name: 'John',
        last_name: 'Doe',
        password: hashedPassword,
        role: 'STUDENT',
        institution_id: ug.id,
        status: 'ACTIVE'
      }
    });

    await User.findOrCreate({
      where: { email: 'security@ug.edu.gh' },
      defaults: {
        first_name: 'UG',
        last_name: 'Security',
        password: hashedPassword,
        role: 'SECURITY',
        institution_id: ug.id,
        status: 'ACTIVE'
      }
    });

    // ─── KNUST ────────────────────────────────────────────────────────────────
    const [knust] = await Institution.findOrCreate({
      where: { domain: 'knust.edu.gh' },
      defaults: {
        name: 'KNUST',
        slug: 'knust-kumasi',
        boundary: [
          [6.662, -1.585], [6.695, -1.585], [6.695, -1.555], [6.662, -1.555], [6.662, -1.585]
        ],
        center_lat: 6.6745,
        center_lng: -1.5715,
        zoom_level: 15
      }
    });

    // KNUST Landmarks
    const knustLandmarks = [
      { label: 'Great Hall', zone: 'Central', lat: 6.6748, lng: -1.5720, intensity: 'landmark', types: 'Event, Administrative' },
      { label: 'Unity Hall', zone: 'Residential', lat: 6.6780, lng: -1.5680, intensity: 'medium', types: 'Hostel' },
      { label: 'Engineering Block', zone: 'Academic', lat: 6.6720, lng: -1.5750, intensity: 'low', types: 'Department' },
      { label: 'Security HQ', zone: 'Security', lat: 6.6760, lng: -1.5700, intensity: 'landmark', types: 'Security, Police' }
    ];

    for (const lm of knustLandmarks) {
      await Hotspot.findOrCreate({
        where: { institution_id: knust.id, label: lm.label },
        defaults: { ...lm, institution_id: knust.id }
      });
    }

    await User.findOrCreate({
      where: { email: 'admin@knust.edu.gh' },
      defaults: {
        first_name: 'KNUST',
        last_name: 'Admin',
        password: hashedPassword,
        role: 'SCHOOL_ADMIN',
        institution_id: knust.id,
        status: 'ACTIVE'
      }
    });


    await User.findOrCreate({
      where: { email: 'student@knust.edu.gh' },
      defaults: {
        first_name: 'Jane',
        last_name: 'Smith',
        password: hashedPassword,
        role: 'STUDENT',
        institution_id: knust.id,
        status: 'ACTIVE'
      }
    });

    // ─── System Admin ─────────────────────────────────────────────────────────
    const [superAdmin] = await Institution.findOrCreate({
      where: { domain: 'safecampus.edu' },
      defaults: {
        name: 'SafeCampus System',
        slug: 'system',
        zoom_level: 10
      }
    });

    await User.findOrCreate({
      where: { email: 'admin@safecampus.edu' },
      defaults: {
        first_name: 'System',
        last_name: 'Admin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        institution_id: superAdmin.id,
        status: 'ACTIVE'
      }
    });

    console.log('[seed]: Seeding completed successfully with boundaries and landmarks.');

    console.log('[seed]: Credentials (all use "password123"):');
    console.log('       - UG: admin@ug.edu.gh, student@ug.edu.gh');
    console.log('       - KNUST: admin@knust.edu.gh');
    console.log('       - System: admin@safecampus.edu');
  } catch (error) {
    console.error('[seed]: Failed to seed database', error);
  }
}

// Allow running directly
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

