import { DataTypes } from 'sequelize';
import sequelize from '../../../../../db.js';

const DeliveryInfo = sequelize.define('DeliveryInfo', {
  id: {
    type: DataTypes.UUID,
    defaultValue: sequelize.literal('gen_random_uuid()'),
    primaryKey: true,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  game_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  rua: {
    type: DataTypes.STRING,
    allowNull: false
  },
  numero: {
    type: DataTypes.STRING,
    allowNull: false
  },
  bairro: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cidade: {
    type: DataTypes.STRING,
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cep: {
    type: DataTypes.STRING,
    allowNull: false
  },
  premio_enviado: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
}, {
  tableName: 'DeliveryInfos',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default DeliveryInfo;

