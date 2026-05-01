const { Institution } = require('./src/models');
const { Op } = require('sequelize');

async function checkInstitutions() {
  try {
    const insts = await Institution.findAll({
      attributes: ['name', 'domain', 'created_at']
    });
    console.log('Total Institutions:', insts.length);
    insts.forEach(i => {
      console.log(`- ${i.name} (${i.domain}) created at: ${i.created_at}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkInstitutions();
