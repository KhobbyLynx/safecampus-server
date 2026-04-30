import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class EmergencyContact extends Model {
  public id!: string;
  public user_id!: string;
  public name!: string;
  public relationship!: string;
  public phone!: string;
  public is_primary!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmergencyContact.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    relationship: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'EmergencyContact',
    tableName: 'emergency_contacts',
    underscored: true,
  }
);

export default EmergencyContact;
