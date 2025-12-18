import { DataTypes } from 'sequelize';
import sequelize from '../../../../../db.js';


const Game = sequelize.define('Game', {
  id: {
    type: DataTypes.UUID,
    defaultValue: sequelize.literal('gen_random_uuid()'),
    primaryKey: true,
    allowNull: false
  },
  winning_button: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  ended_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  min_players: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1000
  },
  preco: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  }
}, {
  tableName: 'Games',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Game;

