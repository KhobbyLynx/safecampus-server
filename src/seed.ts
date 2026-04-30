import { sequelize, Institution, User } from './models';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    // Check if we already have data
    await sequelize.sync({ alter: true });
    console.log('[seed]: Database synced');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // ─── University Of Ghana ──────────────────────────────────────────────────
    const [ug] = await Institution.findOrCreate({
      where: { domain: 'ug.edu.gh' },
      defaults: {
        name: 'University of Ghana',
        slug: 'ug-legon',
        boundary: JSON.stringify({
          type: "Polygon",
          coordinates: [[[-0.18, 5.65], [-0.19, 5.65], [-0.19, 5.66], [-0.18, 5.66], [-0.18, 5.65]]]
        }),
        zoom_level: 15
      }
    });

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
        first_name: 'Test',
        last_name: 'Student',
        password: hashedPassword,
        role: 'STUDENT',
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
        boundary: JSON.stringify({
          type: "Polygon",
          coordinates: [[[-1.56, 6.67], [-1.57, 6.67], [-1.57, 6.68], [-1.56, 6.68], [-1.56, 6.67]]]
        }),
        zoom_level: 15
      }
    });

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
    console.log('       - UG: admin@ug.edu.gh, student@ug.edu.gh');
    console.log('       - KNUST: admin@knust.edu.gh');
    console.log('       - System: admin@safecampus.edu');

    }
  } catch (error) {
    console.error('[seed]: Failed to seed database', error);
  }
}

// Allow running directly
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

