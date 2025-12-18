import jwt from 'jsonwebtoken';
import Payment from '../models/payment.js';
import Game from '../models/game.js';
import User from '../models/user.js';


export default async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token não fornecido.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.email) {
      return res.status(401).json({ message: 'Token inválido (sem email).' });
    }

    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const game = await Game.findOne({ order: [['created_at', 'DESC']] });
    if (!game) {
      return res.status(404).json({ message: 'Jogo não encontrado.' });
    }

    const payment = await Payment.findOne({
      where: {
        user_id: user.id,
        game_id: game.id
      }
    });

    if (!payment) {
      return res.status(403).json({ message: 'Pagamento não encontrado. Você não pode jogar.' });
    }

    req.user = user;
    req.game = game;
    next();
  } catch (err) {
    console.error('Erro ao verificar pagamento:', err.message);
    return res.status(401).json({ message: 'Token inválido ou erro ao verificar pagamento.' });
  }
};
