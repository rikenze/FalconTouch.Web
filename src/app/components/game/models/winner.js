import { DataTypes } from 'sequelize';
import sequelize from '../../../../../db.js';

const Winner = sequelize.define('Winner', {
  clicked_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE',
  },
  game_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Games',
      key: 'id'
    },
    onDelete: 'CASCADE',
  }
}, {
  timestamps: false,
  tableName: 'Winners'
});

export default Winner;
