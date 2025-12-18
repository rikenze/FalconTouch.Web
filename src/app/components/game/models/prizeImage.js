import { DataTypes } from 'sequelize';
import sequelize from '../../../../../db.js';

const PrizeImage = sequelize.define('PrizeImage', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  prize_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  imagem: {
    type: DataTypes.BLOB,
    allowNull: false
  }
}, {
  tableName: 'PrizeImages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default PrizeImage;
