import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import Institution from './Institution';

class User extends Model {
  public id!: string;
  public email!: string;
  public password!: string;
  public first_name!: string;
  public last_name!: string;
  public role!: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'SECURITY' | 'STUDENT';
  public institution_id!: string;
  public preferences!: any;
  public reset_token!: string | null;
  public reset_token_expires!: Date | null;
  public status!: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  public badge_number?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('SUPER_ADMIN', 'SCHOOL_ADMIN', 'SECURITY', 'STUDENT'),
    defaultValue: 'STUDENT',
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Institution,
      key: 'id',
    }
  },
  preferences: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      notifications: {
        pushCritical: true,
        pushUpdates: true,
        emailCritical: true,
        emailWeekly: false,
        smsSOS: true,
      },
      privacy: {
        anonymousReporting: true,
        locationSharing: false,
        twoFactor: false,
      }
    }
  },
  reset_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  reset_token_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'PENDING', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
  badge_number: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
});

// Associations
User.belongsTo(Institution, { foreignKey: 'institution_id' });
Institution.hasMany(User, { foreignKey: 'institution_id' });

export default User;
