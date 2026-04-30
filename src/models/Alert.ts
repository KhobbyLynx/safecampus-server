import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Alert extends Model {
  public id!: string;
  public institution_id!: string;
  public title!: string;
  public description!: string;
  public type!: 'CRITICAL' | 'WARNING' | 'INFO';
  public location!: string;
  public expires_at!: Date | null;
  public readonly created_at!: Date;
}

Alert.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
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
    type: DataTypes.ENUM('CRITICAL', 'WARNING', 'INFO'),
    defaultValue: 'INFO',
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  sequelize,
  modelName: 'Alert',
  tableName: 'alerts',
  underscored: true,
});

export default Alert;
