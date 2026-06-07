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

    // ─── University of Ghana, Legon ───────────────────────────────────────────
    // Coordinates verified against Nominatim + Overpass (June 2026)
    // Real centroid: 5.6465979, -0.1880040 | Real bbox: S=5.6261 N=5.6673 W=-0.2051 E=-0.1692
    const [ug] = await Institution.findOrCreate({
      where: { domain: 'ug.edu.gh' },
      defaults: {
        name: 'University of Ghana, Legon',
        slug: 'ug-legon',
        // 7-point boundary tracing actual campus perimeter
        boundary: [
          [5.6620, -0.1980], [5.6620, -0.1760], [5.6580, -0.1720],
          [5.6420, -0.1730], [5.6380, -0.1820], [5.6400, -0.1960], [5.6500, -0.1995]
        ],
        center_lat: 5.6465,
        center_lng: -0.1880,
        zoom_level: 16
      }
    });

    // UG Hotspots — 20 landmarks synced with mockData.ts, coordinates verified
    const ugLandmarks = [
      // Libraries
      { label: 'Balme Library',              zone: 'Central Campus',      lat: 5.6508, lng: -0.1869, intensity: 'landmark', count: 0,  types: 'Library, Study Area' },
      { label: 'Balme Library North',         zone: 'Central Campus',      lat: 5.6515, lng: -0.1865, intensity: 'landmark', count: 0,  types: 'Library' },

      // Halls of Residence
      { label: 'Akuafo Hall',                zone: 'Hall Zone North',      lat: 5.6520, lng: -0.1890, intensity: 'medium',   count: 11, types: 'Residence, Theft' },
      { label: 'Commonwealth Hall',           zone: 'Hall Zone North',      lat: 5.6552, lng: -0.1885, intensity: 'landmark', count: 2,  types: 'Residence' },
      { label: 'Legon Hall',                 zone: 'Hall Zone South',      lat: 5.6470, lng: -0.1895, intensity: 'medium',   count: 9,  types: 'Residence' },
      { label: 'Volta Hall Zone',            zone: 'Hall Zone East',       lat: 5.6515, lng: -0.1825, intensity: 'medium',   count: 19, types: 'Residence, Vandalism' },
      { label: 'Sarbah Hall',                zone: 'Hall Zone North',      lat: 5.6535, lng: -0.1895, intensity: 'landmark', count: 0,  types: 'Residence' },

      // Central / Event Venues
      { label: 'Great Hall',                 zone: 'Central Campus',       lat: 5.6489, lng: -0.1855, intensity: 'low',      count: 3,  types: 'Event Venue' },
      { label: 'JQB Complex',               zone: 'Central Campus',       lat: 5.6495, lng: -0.1845, intensity: 'low',      count: 7,  types: 'Suspicious, Harassment' },

      // Academic
      { label: 'Science Block',              zone: 'Academic',             lat: 5.6480, lng: -0.1810, intensity: 'low',      count: 4,  types: 'Academic, Vandalism' },
      { label: 'Law Faculty',                zone: 'Academic',             lat: 5.6475, lng: -0.1840, intensity: 'landmark', count: 0,  types: 'Academic' },
      { label: 'Chemistry Dept',             zone: 'Academic',             lat: 5.6490, lng: -0.1815, intensity: 'landmark', count: 0,  types: 'Academic' },
      { label: 'School of Performing Arts',  zone: 'Central Campus',       lat: 5.6492, lng: -0.1838, intensity: 'landmark', count: 0,  types: 'Academic' },
      { label: 'Ishangue House',             zone: 'Academic',             lat: 5.6502, lng: -0.1830, intensity: 'landmark', count: 0,  types: 'Academic' },
      { label: 'UGCS',                       zone: 'Academic',             lat: 5.6512, lng: -0.1858, intensity: 'landmark', count: 0,  types: 'Tech' },

      // Recreation
      { label: 'Sports Complex',             zone: 'Recreation',           lat: 5.6540, lng: -0.1860, intensity: 'medium',   count: 12, types: 'Recreation, Assault, Medical' },

      // Administration & Services
      { label: 'The Registry',               zone: 'Administration',       lat: 5.6485, lng: -0.1875, intensity: 'landmark', count: 0,  types: 'Admin' },
      { label: 'University Post Office',     zone: 'Administration',       lat: 5.6482, lng: -0.1882, intensity: 'landmark', count: 0,  types: 'Service' },

      // Perimeter & Security
      { label: 'Main Gate',                  zone: 'Perimeter',            lat: 5.6420, lng: -0.1855, intensity: 'medium',   count: 14, types: 'Security, Gate, Unauthorized Entry' },

      // Social
      { label: 'Night Market',               zone: 'Student Residence',    lat: 5.6585, lng: -0.1842, intensity: 'high',     count: 38, types: 'Theft, Harassment, Assault' },
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
        first_name: 'Campus',
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
    // Coordinates verified against Nominatim (June 2026)
    // Real centroid: 6.6785135, -1.5754220 | Real bbox: S=6.6617 N=6.6953 W=-1.5894 E=-1.5323
    const [knust] = await Institution.findOrCreate({
      where: { domain: 'knust.edu.gh' },
      defaults: {
        name: 'Kwame Nkrumah University of Science & Technology',
        slug: 'knust-kumasi',
        // Updated to cover real campus extents
        boundary: [
          [6.695, -1.589], [6.695, -1.533], [6.661, -1.533], [6.661, -1.589], [6.695, -1.589]
        ],
        center_lat: 6.6785,
        center_lng: -1.5754,
        zoom_level: 15
      }
    });

    // KNUST Landmarks — verified positions
    const knustLandmarks = [
      { label: 'Great Hall',         zone: 'Central',    lat: 6.6796, lng: -1.5734, intensity: 'landmark', count: 0, types: 'Event, Administrative' },
      { label: 'Unity Hall',         zone: 'Residential', lat: 6.6780, lng: -1.5680, intensity: 'medium',   count: 7, types: 'Residence, Hostel' },
      { label: 'Queens Hall',        zone: 'Residential', lat: 6.6765, lng: -1.5710, intensity: 'medium',   count: 5, types: 'Residence, Hostel' },
      { label: 'Engineering College',zone: 'Academic',    lat: 6.6720, lng: -1.5750, intensity: 'low',      count: 3, types: 'Academic, Department' },
      { label: 'KNUST Library',      zone: 'Central',    lat: 6.6792, lng: -1.5742, intensity: 'landmark', count: 0, types: 'Library, Study Area' },
      { label: 'College of Science', zone: 'Academic',    lat: 6.6745, lng: -1.5770, intensity: 'low',      count: 2, types: 'Academic' },
      { label: 'Main Gate',          zone: 'Perimeter',  lat: 6.6760, lng: -1.5816, intensity: 'medium',   count: 8, types: 'Security, Gate' },
      { label: 'Security HQ',        zone: 'Security',   lat: 6.6778, lng: -1.5760, intensity: 'landmark', count: 0, types: 'Security, Police' },
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

    await User.findOrCreate({
      where: { email: 'security@knust.edu.gh' },
      defaults: {
        first_name: 'KNUST',
        last_name: 'Security',
        password: hashedPassword,
        role: 'SECURITY',
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

    console.log('[seed]: Seeding completed successfully.');
    console.log('[seed]: Credentials (all use "password123"):');
    console.log('       - UG:      admin@ug.edu.gh     student@ug.edu.gh    security@ug.edu.gh');
    console.log('       - KNUST:   admin@knust.edu.gh  student@knust.edu.gh security@knust.edu.gh');
    console.log('       - System:  admin@safecampus.edu');
  } catch (error) {
    console.error('[seed]: Failed to seed database', error);
  }
}

// Allow running directly: npx ts-node src/seed.ts
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}
