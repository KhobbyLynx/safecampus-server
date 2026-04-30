import { sequelize, Institution, User } from './models';

async function seed() {
  try {
    await sequelize.sync({ force: true });
    console.log('[seed]: Database synced (force: true) - Clean Slate');

    console.log('[seed]: Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[seed]: Failed to seed database', error);
    process.exit(1);
  }
}

seed();
