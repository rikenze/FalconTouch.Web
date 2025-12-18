import '../../../../../env.js';
import express from 'express';
import verifyAdmin from '../middlewares/verifyAdmin.js';
import { loadCurrentGameData } from '../utils/loadCurrentGameData.js';
import { logger } from '../../game/utils/logger.js';
import Influencer from '../models/influencer.js';
import Payment from '../models/payment.js';

export default (io) => {
  const router = express.Router();

  /**
   * GET /api/game/influencer
   * Lista todos os influenciadores (admin)
   */
  router.get('/', verifyAdmin, async (req, res) => {
    try {
      const influencers = await Influencer.findAll({
        order: [['created_at', 'DESC']]
      });

      const { game: currentGame } = await loadCurrentGameData();
      if (!currentGame) {
        return res.status(400).json({ message: 'Nenhum jogo ativo encontrado.' });
      }

      // Para cada influenciador, conta os pagamentos aprovados
      const result = await Promise.all(
        influencers.map(async (inf) => {
          const paidCount = await Payment.count({
            where: {
              influencer_id: inf.id,
              paid: true,
              game_id: currentGame.id
            }
          });

          const follower_count = inf.follower_count || 0;
          const minimumPercent = parseFloat(inf.minimum_follower_percentage || 0); 
          const conversionGoal = Math.round(follower_count * (minimumPercent / 100));

          const metaAtingida = paidCount >= conversionGoal;

          return {
            ...inf.toJSON(),
            paidCount,
            conversionGoal,
            conversionDisplay: `${paidCount} / ${conversionGoal}`,
            conversionStatus: metaAtingida ? 'Meta Atingida' : 'Abaixo da Meta',
            conversionPercent: follower_count > 0 ? (paidCount / follower_count) * 100 : 0
          };
        })
      );

      res.json(result);
    } catch (err) {
      logger.error('Erro ao buscar influenciadores:', err);
      res.status(500).json({ message: 'Erro ao buscar influenciadores.' });
    }
  });

  /**
   * POST /api/game/influencer
   * Cria um novo influenciador (admin)
   */
  router.post('/', verifyAdmin, async (req, res) => {
    try {
        const influencer = await Influencer.create({
        ...req.body,
        code: req.body.code.toLowerCase()
        });
      res.status(201).json(influencer);
    } catch (err) {
      logger.error('Erro ao criar influenciador:', err);
      res.status(500).json({ message: 'Erro ao criar influenciador.' });
    }
  });

  /**
   * PUT /api/game/influencer/:id
   * Atualiza um influenciador existente (admin)
   */
  router.put('/:id', verifyAdmin, async (req, res) => {
    try {
      const influencer = await Influencer.findByPk(req.params.id);
      if (!influencer) {
        return res.status(404).json({ message: 'Influenciador não encontrado.' });
      }

        await influencer.update({
        ...req.body,
        code: req.body.code?.toLowerCase() || influencer.code
        });
      res.json(influencer);
    } catch (err) {
      logger.error('Erro ao atualizar influenciador:', err);
      res.status(500).json({ message: 'Erro ao atualizar influenciador.' });
    }
  });

  /**
   * DELETE /api/game/influencer/:id
   * Remove um influenciador (admin)
   */
  router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
      const influencer = await Influencer.findByPk(req.params.id);
      if (!influencer) {
        return res.status(404).json({ message: 'Influenciador não encontrado.' });
      }

      await influencer.destroy();
      res.json({ message: 'Influenciador deletado com sucesso.' });
    } catch (err) {
      logger.error('Erro ao deletar influenciador:', err);
      res.status(500).json({ message: 'Erro ao deletar influenciador.' });
    }
  });

  /**
   * GET /api/game/influencer/validar-cupom/:code
   * Valida um cupom de influenciador (público)
   */
  router.get('/validar-cupom/:code', async (req, res) => {
    const { code } = req.params;

    try {
      const influencer = await Influencer.findOne({
        where: {
          code: code.toLowerCase(),
          active: true
        }
      });

      if (!influencer) {
        return res.status(404).json({ message: 'Cupom inválido ou inativo.' });
      }

      const { game: currentGame } = await loadCurrentGameData();
      if (!currentGame) {
        return res.status(400).json({ message: 'Jogo ativo não encontrado.' });
      }

      const descontoPercentual = Number(influencer.discount_percent || 0);
      const valorOriginal = Number(currentGame.preco); 
      const valorComDesconto = Number((valorOriginal * (1 - descontoPercentual / 100)).toFixed(2));

      let comission = 0;
      if (influencer.commission_type === 'per_player') {
        comission = parseFloat(influencer.commission_value); 
      }

      return res.json({
        precoComDesconto: valorComDesconto,
        influencer_id: influencer.id,
        discount_percent: descontoPercentual,
        precoOriginal: valorOriginal,
        comission: comission
      });

    } catch (err) {
      logger.error('Erro ao validar cupom:', err);
      return res.status(500).json({ message: 'Erro interno ao validar cupom.' });
    }
  });

  return router;
};
