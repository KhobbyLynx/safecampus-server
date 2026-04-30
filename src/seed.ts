import { sequelize, Institution, User } from './models';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    // Check if we already have data
    const userCount = await User.count();
    if (userCount > 0) {
      console.log('[seed]: Database already has data, skipping auto-seed.');
      return;
    }

    await sequelize.sync({ alter: true });
    console.log('[seed]: Database synced');

    // Use findOrCreate for the Institution to avoid duplicates
    const [institution] = await Institution.findOrCreate({
      where: { domain: 'safecampus.edu' },
      defaults: {
        name: 'SafeCampus Demo University',
        slug: 'demo-uni',
        boundary: JSON.stringify({
          type: "Polygon",
          coordinates: [[[-0.18, 5.65], [-0.19, 5.65], [-0.19, 5.66], [-0.18, 5.66], [-0.18, 5.65]]]
        }),
        zoom_level: 16
      }
    });

    // Use findOrCreate for the Default Admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const [user, created] = await User.findOrCreate({
      where: { email: 'admin@safecampus.edu' },
      defaults: {
        first_name: 'System',
        last_name: 'Admin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        institution_id: institution.id,
        status: 'ACTIVE'
      }
    });

    if (created) {
      console.log('[seed]: Seeding completed successfully. Created default admin: admin@safecampus.edu / admin123');
    } else {
      console.log('[seed]: Admin user already exists. No new data created.');
    }
  } catch (error) {
    console.error('[seed]: Failed to seed database', error);
  }
}

// Allow running directly
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

