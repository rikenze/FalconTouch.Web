import { DataTypes } from 'sequelize';
import sequelize from '../../../../../db.js';


const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: sequelize.literal('gen_random_uuid()')
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_method: {
    type: DataTypes.STRING(50),
    unique: false,
    allowNull: false
  },
  txid: {
    type: DataTypes.STRING(35),
    unique: true,
    allowNull: true,
    validate: {
      is: /^[a-zA-Z0-9]{26,35}$/
    }
  },
  paid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  game_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Games',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
 coupon_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  influencer_id: { 
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Influencers',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  commission_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  discount: { 
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },

}, {
  timestamps: false,
  tableName: 'Payments'
});

export default Payment;
