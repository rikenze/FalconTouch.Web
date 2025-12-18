const Game = require('../models/game');
const Winner = require('../models/winner');
const User = require('../models/user');

// Cria um novo jogo (por exemplo, ao iniciar a partida)
exports.createGame = async (req, res) => {
  try {
    await sequelize.authenticate();

    const { minPlayers = 1000, winning_button } = req.body;

    const game = await Game.create({
      winning_button,
      ativo: false,
      min_players: minPlayers,
      ativo: false,
      preco: 12.00,
      premio: 'IPhone 13 Pro Max'
    });

    // Sincronize min_players para Redis aqui, se quiser garantir consistência
    const redisClient = require('../../../../../redisClient');
    await redisClient.set('minPlayers', game.min_players.toString());

    res.status(201).json(game);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar jogo', error });
  }
};


// Registra o vencedor de um jogo
exports.registerWinner = async (req, res) => {
  try {
    const { user_email, game_id } = req.body;

    const user = await User.findOne({ where: { email: user_email } });
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const winner = await Winner.create({
      user_id: user.id,
      game_id
    });

    res.status(201).json(winner);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao registrar vencedor', error });
  }
};
