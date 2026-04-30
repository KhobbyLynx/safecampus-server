import sequelize from '../config/database';
import Institution from './Institution';
import User from './User';
import Incident from './Incident';
import Hotspot from './Hotspot';
import Alert from './Alert';
import Buddy from './Buddy';
import EmergencyContact from './EmergencyContact';

// Relationships
Institution.hasMany(Hotspot, { foreignKey: 'institution_id' });
Hotspot.belongsTo(Institution, { foreignKey: 'institution_id' });

Institution.hasMany(Alert, { foreignKey: 'institution_id' });
Alert.belongsTo(Institution, { foreignKey: 'institution_id' });

// User Safety Relationships
User.hasMany(Buddy, { foreignKey: 'user_id', as: 'buddies_added' });
User.hasMany(Buddy, { foreignKey: 'buddy_id', as: 'buddies_received' });
Buddy.belongsTo(User, { foreignKey: 'user_id', as: 'requester_info' });
Buddy.belongsTo(User, { foreignKey: 'buddy_id', as: 'buddy_info' });

User.hasMany(EmergencyContact, { foreignKey: 'user_id', as: 'emergency_contacts' });
EmergencyContact.belongsTo(User, { foreignKey: 'user_id' });

const models = {
  Institution,
  User,
  Incident,
  Hotspot,
  Alert,
  Buddy,
  EmergencyContact
};

export { sequelize, Institution, User, Incident, Hotspot, Alert, Buddy, EmergencyContact };
export default models;
