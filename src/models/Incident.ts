import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import Institution from './Institution';
import User from './User';

class Incident extends Model {
  public id!: string;
  public title!: string;
  public description!: string;
  public type!: string;
  public priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  public status!: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  public location_name?: string;
  public location_lat!: number;
  public location_lng!: number;
  public is_anonymous!: boolean;
  public reporter_id?: string;
  public submitted_by_id?: string;
  public assignee_id?: string;
  public institution_id!: string;
  public assigned_at?: Date;
  public remarks?: string;
  public media?: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations
  public readonly reporter?: User;
  public readonly assignee?: User;
}

Incident.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'),
    defaultValue: 'PENDING',
  },
  location_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  location_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  reporter_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    }
  },
  submitted_by_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    }
  },
  assignee_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    }
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Institution,
      key: 'id',
    }
  },
  assigned_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  media: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  sequelize,
  modelName: 'Incident',
  tableName: 'incidents',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associations
Incident.belongsTo(Institution, { foreignKey: 'institution_id' });
Incident.belongsTo(User, { as: 'reporter', foreignKey: 'reporter_id' });
Incident.belongsTo(User, { as: 'assignee', foreignKey: 'assignee_id' });
Institution.hasMany(Incident, { foreignKey: 'institution_id' });

export default Incident;
