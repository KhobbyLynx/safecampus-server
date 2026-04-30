import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

class Buddy extends Model {
  public id!: string;
  public user_id!: string;
  public buddy_id!: string;
  public status!: 'PENDING' | 'ACCEPTED' | 'SHARING';
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Buddy.init(
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
    buddy_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'SHARING'),
      defaultValue: 'PENDING',
    },
  },
  {
    sequelize,
    modelName: 'Buddy',
    tableName: 'buddies',
    underscored: true,
  }
);

export default Buddy;
