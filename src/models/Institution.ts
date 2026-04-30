import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Institution extends Model {
  public id!: string;
  public name!: string;
  public domain!: string;
  public logo_url?: string;
  public boundary?: any;
  public center_lat?: number;
  public center_lng?: number;
  public zoom_level?: number;
  public config?: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Institution.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  logo_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  boundary: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  center_lat: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  center_lng: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  zoom_level: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 16,
  },
  config: {
    type: DataTypes.JSON,
    allowNull: true,
  }
}, {
  sequelize,
  modelName: 'Institution',
  tableName: 'institutions',
});

export default Institution;
