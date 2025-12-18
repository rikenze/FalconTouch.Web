import '../../../../../env.js';
import express from 'express';
import redisClient from '../../../../../redisClient.js';
import verifyAdmin from '../middlewares/verifyAdmin.js';
import { loadCurrentGameData } from '../utils/loadCurrentGameData.js';
import { emitPlayerStats } from '../utils/gameStatsEmitter.js';
import { User, Game, Payment, Winner, Prize } from '../models/index.js';
import clientTwilio from '../../../../../twilioClient.js';
import { logger } from '../../game/utils/logger.js'
import { generateFakeRanking } from '../../game/utils/fakeRanking.js';

export default (io) => {
  const router = express.Router();

  // GET /api/game/admin/config → Obter configuração atual
  router.get('/config', verifyAdmin, async (req, res) => {
    try {
      const currentGame = await Game.findOne({
        order: [['created_at', 'DESC']]
      });

      if (!currentGame) {
        return res.status(404).json({ message: 'Nenhum jogo encontrado.' });
      }

      const prize = await Prize.findOne({ where: { game_id: currentGame.id } });

      if (!prize) {
        return res.status(404).json({ message: 'Nenhum premio encontrado.' });
      }

      res.json({
        minPlayers: currentGame.min_players,
        preco: currentGame.preco,
        premio: prize.descricao,
        jogoAtivo: currentGame.ativo
      });
    } catch (err) {
      console.error('Erro ao obter configurações:', err);
      res.status(500).json({ message: 'Erro ao buscar configuração.' });
    }
  });

  // POST /api/game/admin/jogoativo
  router.post('/jogoativo', verifyAdmin, async (req, res) => {
    let { jogoAtivo } = req.body;

    const parsedJogoAtivo = (typeof jogoAtivo === 'string')
      ? jogoAtivo.toLowerCase() === 'true'
      : Boolean(jogoAtivo);

    // Validações
    if (typeof parsedJogoAtivo !== 'boolean') {
      return res.status(400).json({ message: 'Status do jogo inválido' });
    }

    try {
      // Atualiza no Redis
      await redisClient.set('jogoAtivo', parsedJogoAtivo ? 'true' : 'false');

      // Atualiza no banco de dados - jogo mais recente
      const currentGame = await Game.findOne({ order: [['created_at', 'DESC']] });
      if (currentGame) {
        currentGame.ativo = parsedJogoAtivo;
        await currentGame.save();
        console.log(`Configurações atualizadas no banco para o jogo ID ${currentGame.id}`);
      } else {
        console.warn('Nenhum jogo encontrado para atualizar no banco.');
      }

      return res.json({
        message: 'Configurações atualizadas com sucesso.',
        jogoAtivo: parsedJogoAtivo,
      });
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      return res.status(500).json({ message: 'Erro ao salvar configuração.' });
    }
  });

  // POST /api/game/admin/config → Atualizar configuração
  router.post('/config', verifyAdmin, async (req, res) => {
    let { minPlayers, preco, premio } = req.body;

    const parsedMinPlayers = parseInt(minPlayers);
    const parsedPreco = parseFloat(preco);
    const parsedPremio = String(premio);

    // Validações
    if (isNaN(parsedMinPlayers) || parsedMinPlayers < 1) {
      return res.status(400).json({ message: 'minPlayers inválido' });
    }

    if (isNaN(parsedPreco) || parsedPreco <= 0) {
      return res.status(400).json({ message: 'Preço inválido' });
    }

    if (!parsedPremio || parsedPremio.trim() === '') {
      return res.status(400).json({ message: 'Prêmio inválido' });
    }

    try {
      // Atualiza no Redis
      await redisClient.set('minPlayers', parsedMinPlayers.toString());
      await redisClient.set('preco', parsedPreco.toString());
      await redisClient.set('premio', parsedPremio.toString());

      // Atualiza no banco de dados - jogo mais recente
      const currentGame = await Game.findOne({ order: [['created_at', 'DESC']] });
      if (currentGame) {
        currentGame.min_players = parsedMinPlayers;
        currentGame.preco = parsedPreco;
        await currentGame.save();
        console.log(`Configurações atualizadas no banco para o jogo ID ${currentGame.id}`);
      } else {
        console.warn('Nenhum jogo encontrado para atualizar no banco.');
      }

      const prize = await Prize.findOne({ where: { game_id: currentGame.id } });
      if (!prize){
        await Prize.create({
          game_id: currentGame.id,
          descricao: parsedPremio
        });
      }else{
        prize.descricao = parsedPremio;
        await prize.save();
      }

      const { playersPaidCount } = await loadCurrentGameData();
      io.emit('players-paid-count', { current: playersPaidCount, min: currentGame.min_players });

      io.emit('premio-descricao-atualizado', {
        descricao: parsedPremio,
      });

      io.emit('preco-atualizado', {
        preco: parsedPreco,
      });

      return res.json({
        message: 'Configurações atualizadas com sucesso.',
        minPlayers: parsedMinPlayers,
        preco: parsedPreco,
        premio: parsedPremio
      });
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      return res.status(500).json({ message: 'Erro ao salvar configuração.' });
    }
  });

  // POST /api/game/admin/release → Forçar início de jogo
  router.post('/release', verifyAdmin, async (req, res) => {
    try {
      const { game: currentGame, playersPaidCount } = await loadCurrentGameData();

      //// Desabilitado para implementar o ranking fake
      // if (playersPaidCount < currentGame.min_players) {
      //   return res.status(400).json({ message: 'Jogadores pagos insuficientes.' });
      // }

      const gameStarted = await redisClient.get('gameStarted');
      const winner = await redisClient.get('winner');

      if (gameStarted === 'true' || winner) {
        return res.status(400).json({ message: 'Jogo já iniciado ou finalizado.' });
      }

      const countdown = parseInt(req.body.countdown) || 5;
      const gameReleased = true;
      const winningIndex = Math.floor(Math.random() * 8);

      // Início do jogo
      await redisClient.del('winner');
      await redisClient.set('winningButtonIndex', winningIndex.toString());
      await redisClient.set('gameReleased', 'true');
      await redisClient.set('gameStarted', 'true');
      await redisClient.set('gameStartTime', Date.now().toString());
      await redisClient.del('clickRanking'); // zera ranking anterior, se houver

      // Notifica os jogadores
      io.emit('start-countdown', { countdown, gameReleased });
      io.emit('release-buttons', { winningIndex });

      // ⏳ Aguarda X segundos para montar o ranking final
      setTimeout(async () => {
        const raw = await redisClient.lRange('clickRanking', 0, -1);
        const allClicks = raw.map(r => JSON.parse(r));

        const connectedRaw = await redisClient.sMembers('players');
        const connected = connectedRaw.map(p => JSON.parse(p));

        const filtered = allClicks.filter(c => connected.find(p => p.id === c.id));
        let sorted = filtered.sort((a, b) => a.time - b.time);

        if (sorted.length <= currentGame.min_players) {
            let fakeRanking = generateFakeRanking(10);

            sorted = fakeRanking;
            const winner = sorted[0];

            io.emit('winner', {
              winnerId: winner.id,
              playerEmail: winner.email,
              buttonIndex: winner.buttonIndex.toString()
            });

            io.emit('ranking', sorted);
          } else {
            const winner = sorted[0];

            await Winner.create({
              user_id: winner.id,
              game_id: currentGame.id,
              button_index: winner.buttonIndex
            });

            io.emit('winner', {
              winnerId: winner.id,
              playerEmail: winner.email,
              buttonIndex: winner.buttonIndex.toString()
            });

            io.emit('ranking', sorted.slice(0, 10));
        }

        // Reset parcial
        await redisClient.del('players');
        await redisClient.del('clickRanking');
        await redisClient.set('gameReleased', 'false');
        await redisClient.set('gameStarted', 'false');
        await redisClient.set('minPlayers', '1000');

        await Game.create({
          winning_button: winningIndex,
          ativo: false,
          created_at: new Date(),
          ended_at: null,
          min_players: 1000,
          ativo: false,
          preco: 12.00,
        });

      }, 14000); // tempo de reação

      // Emite novamente após resetar o jogo
      await emitPlayerStats(io);

      res.json({
        message: 'Jogo liberado com sucesso!',
        countdown,
        winningIndex
      });
    } catch (err) {
      console.error('Erro ao liberar jogo:', err);
      res.status(500).json({ message: 'Erro ao liberar o jogo.' });
    }
  });

  router.post('/send-whatsapp', verifyAdmin, async (req, res) => {
    try {
      const currentGame = await Game.findOne({
        order: [['created_at', 'DESC']]
      });

      const jogadores = await Payment.findAll({
        where: { game_id: currentGame.id },
        include: [{
          model: User,
          attributes: ['id', 'email', 'phone']
        }]
      });
      const numbers = jogadores.map(p => p.User.phone);
      const siteUrl = process.env.APP_URL_PRD || '-';
      const message = `Atenção: O jogo irá começar em instantes. Acesse o site ${siteUrl}, clique em Iniciar Jogo, permaneça na pagina e fique atento para tocar!`;
      const responses = [];

      for (const number of numbers) {
        if (!number || typeof number !== 'string' || number.trim() === '') continue;
        const msg = await clientTwilio.messages.create({
          body: message,
          from: process.env.TWILIO_SMS_NUMBER,
          to: number
        });

        responses.push({ to: number, sid: msg.sid });
      }

      logger.info('Sucesso: /send-whatsapp', { body: responses });
      res.json({ success: true, messages: responses });
    } catch (err) {
      console.error(err);
      logger.info('/send-whatsapp', { body: err });
      res.status(500).json({ error: 'Erro ao enviar mensagens.' });
    }
  });

  // POST /api/game/admin/reset → Resetar o jogo
  router.post('/reset', verifyAdmin, async (req, res) => {
    try {
      // Resetar dados no Redis
      await redisClient.flushAll();
      await redisClient.set('gameReleased', 'false');
      await redisClient.set('gameStarted', 'false');
      await redisClient.del('winner');
      await redisClient.del('winningButtonIndex');

      // Emitir evento reset e player count
      io.emit('reset');

      res.json({ message: 'Jogo resetado com sucesso.' });
    } catch (err) {
      console.error('Erro ao resetar o jogo:', err);
      res.status(500).json({ message: 'Erro ao resetar o jogo.' });
    }
  });




  return router;
};
