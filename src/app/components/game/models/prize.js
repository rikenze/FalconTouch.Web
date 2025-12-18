import { DataTypes } from 'sequelize';
import sequelize from '../../../../../db.js';

const Prize = sequelize.define('Prize', {
  id: {
    type: DataTypes.UUID,
    defaultValue: sequelize.literal('gen_random_uuid()'),
    primaryKey: true
  },
  game_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  descricao: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'Prizes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Prize;
