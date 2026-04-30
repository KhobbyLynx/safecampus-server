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

    // Create a Demo Institution
    const institution = await Institution.create({
      name: 'SafeCampus Demo University',
      slug: 'demo-uni',
      domain: 'safecampus.edu',
      boundary: JSON.stringify({
        type: "Polygon",
        coordinates: [[[-0.18, 5.65], [-0.19, 5.65], [-0.19, 5.66], [-0.18, 5.66], [-0.18, 5.65]]]
      }),
      settings: JSON.stringify({ theme: 'default' })
    });

    // Create a Default Admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      first_name: 'System',
      last_name: 'Admin',
      email: 'admin@safecampus.edu',
      password: hashedPassword,
      role: 'SYSTEM_ADMIN',
      institution_id: institution.id
    });

    console.log('[seed]: Seeding completed successfully. Created default admin: admin@safecampus.edu / admin123');
  } catch (error) {
    console.error('[seed]: Failed to seed database', error);
  }
}

// Allow running directly
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

