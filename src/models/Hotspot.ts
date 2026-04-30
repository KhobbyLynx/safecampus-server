import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Hotspot extends Model {
  public id!: string;
  public institution_id!: string;
  public label!: string;
  public zone!: string;
  public lat!: number;
  public lng!: number;
  public intensity!: 'high' | 'medium' | 'low' | 'landmark';
  public count!: number;
  public last_incident?: string;
  public types!: string; // JSON string or comma separated
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Hotspot.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  zone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lat: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  lng: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  intensity: {
    type: DataTypes.ENUM('high', 'medium', 'low', 'landmark'),
    allowNull: false,
  },
  count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  last_incident: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  types: {
    type: DataTypes.TEXT,
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'Hotspot',
  tableName: 'hotspots',
});

export default Hotspot;
