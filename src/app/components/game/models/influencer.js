import { DataTypes } from 'sequelize';
import sequelize from '../../../../../db.js';

const Influencer = sequelize.define('Influencer', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: sequelize.literal('gen_random_uuid()')
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  code: {  
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
  },
  commission_type: { 
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'per_player',
  },
  commission_value: { 
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  follower_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  minimum_follower_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0
  },
  discount_percent: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: false,
    defaultValue: 0,
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }
}, {
  tableName: 'Influencers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Influencer;
