import User from './user.js';
import Game from './game.js';
import Winner from './winner.js';
import Payment from './payment.js';
import DeliveryInfo from './deliveryInfo.js';
import Prize from './prize.js';
import PrizeImage from './prizeImage.js';
import Influencer from './influencer.js';

// WINNER
User.hasMany(Winner, { foreignKey: 'user_id' });
Winner.belongsTo(User, { foreignKey: 'user_id' });

Game.hasOne(Winner, { foreignKey: 'game_id' });
Winner.belongsTo(Game, { foreignKey: 'game_id' });

// PAYMENT
User.hasMany(Payment, { foreignKey: 'user_id' });
Payment.belongsTo(User, { foreignKey: 'user_id' });

Game.hasMany(Payment, { foreignKey: 'game_id' });
Payment.belongsTo(Game, { foreignKey: 'game_id' });

// DELIVERY INFO
User.hasMany(DeliveryInfo, { foreignKey: 'user_id' });
DeliveryInfo.belongsTo(User, { foreignKey: 'user_id' });

Game.hasMany(DeliveryInfo, { foreignKey: 'game_id' });
DeliveryInfo.belongsTo(Game, { foreignKey: 'game_id' });

// PRIZE
Game.hasOne(Prize, { foreignKey: 'game_id', as: 'prize' });
Prize.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });

// PRIZE IMAGE
Prize.hasMany(PrizeImage, { foreignKey: 'prize_id', as: 'imagens' });
PrizeImage.belongsTo(Prize, { foreignKey: 'prize_id', as: 'prize' });

// INFLUENCER - PAYMENT
Influencer.hasMany(Payment, { foreignKey: 'influencer_id' });
Payment.belongsTo(Influencer, { foreignKey: 'influencer_id' });

export {
  User,
  Game,
  Winner,
  Payment,
  DeliveryInfo,
  Prize,
  PrizeImage,
  Influencer
};
