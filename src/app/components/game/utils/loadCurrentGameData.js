import { Payment, Game, Prize } from '../models/index.js';
import redisClient from '../../../../../redisClient.js';


// Função isolada para obter e sincronizar players pagos
  export async function loadCurrentGameData() {
    // Pega o jogo mais recente
    let currentGame = await Game.findOne({
      order: [['created_at', 'DESC']]
    });

    if (!currentGame) {
      currentGame = await Game.create({
        winning_button: Math.floor(Math.random() * 8),
        ativo: false,
        created_at: new Date(),
        min_players: 1000,
        ativo: false,
        preco: 12.00,
      });
    }

    let prize = await Prize.findOne({ where: { game_id: currentGame.id } });
    if (!prize){
      prize = await Prize.create({
        game_id: currentGame.id,
        descricao: 'IPhone 13 Pro'
      });
    }

    const redisKey = `playersPaidGame:${currentGame.id}`;

    // Pega IDs pagos no Redis
    const redisPaidIds = await redisClient.sMembers(redisKey);

    // Pega IDs pagos no banco
    const payments = await Payment.findAll({
      where: { 
        game_id: currentGame.id, 
        paid: true 
      },
      attributes: ['user_id'],
      group: ['user_id']
    });
    const dbPaidIds = payments.map(p => p.user_id.toString());

    // Função simples para comparar arrays (ordem não importa)
    const arraysAreEqual = (a, b) => {
      if (a.length !== b.length) return false;
      const setA = new Set(a);
      const setB = new Set(b);
      if (setA.size !== setB.size) return false;
      for (const el of setA) if (!setB.has(el)) return false;
      return true;
    };

    // Sincroniza Redis com banco se diferente
    if (!arraysAreEqual(redisPaidIds, dbPaidIds)) {
      await redisClient.del(redisKey);
      if (dbPaidIds.length > 0) {
        await redisClient.sAdd(redisKey, ...dbPaidIds);
      }
    }

    return {
      premio: prize,
      game: currentGame,
      playersPaidCount: dbPaidIds.length,
    };
  }

export default { loadCurrentGameData };

