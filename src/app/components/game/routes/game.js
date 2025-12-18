import '../../../../../env.js';
import express from 'express';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { User, Payment, Game, DeliveryInfo } from '../models/index.js';
import authenticateToken from '../middlewares/auth.js';
import verifyAdmin from '../middlewares/verifyAdmin.js';
import redisClient from '../../../../../redisClient.js';
import { loadCurrentGameData } from '../utils/loadCurrentGameData.js';
import { EfiService } from '../efi.service.js';
import { verifyEfiWebhook } from '../../game/middlewares/webhookVerifier.js';
import { logger, webhookLogPath } from '../utils/logger.js';
import Prize from '../models/prize.js';
import PrizeImage from '../models/prizeImage.js';
import Influencer from '../models/influencer.js';
import { pixQueue } from '../queues/pixQueue.js';

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

import multer from 'multer';
const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são permitidas'));
    }
    cb(null, true);
  }
});

const router = express.Router();

export default (io) => {
  // Rota para criar jogo
  router.post('/create-game', (req, res, next) => {
    // gameController precisa ser adaptado para ESM também
    import('../controllers/gameController.js').then(({ default: gameController }) => {
      return gameController.createGame(req, res, next);
    }).catch(next);
  });

  router.get('/status', async (req, res) => {
    try {
      const gameStarted = await redisClient.get('gameStarted');
      res.json({ gameStarted: gameStarted === 'true' });
    } catch (err) {
      console.error('Erro no GET /status:', err);
      res.status(500).json({ error: 'Erro ao buscar status atual do jogo.' });
    }
  });

  router.get('/public-current-game', async (req, res) => {
    try {
      let currentGame = await Game.findOne({
        order: [['created_at', 'DESC']],
      });

      if (!currentGame) {
        currentGame = await Game.create({
          winning_button: Math.floor(Math.random() * 8),
          ativo: false,
          created_at: new Date(),
          min_players: 1000,
          preco: 12.00,
        });
      }

      let prize = await Prize.findOne({
        where: { game_id: currentGame.id },
        include: [{
          model: PrizeImage,
          as: 'imagens',
          attributes: ['id', 'imagem'],
        }]
      });

      if (!prize) {
        prize = await Prize.create({
          game_id: currentGame.id,
          descricao: 'IPhone 13 Pro',
        });
      }
      
      if (!prize.imagens || prize.imagens.length === 0) {
        const imagePath = path.resolve('src/assets/images/iphone-13-pro-max.png');
        const imageBuffer = fs.readFileSync(imagePath);

        await PrizeImage.create({
          prize_id: prize.id,
          imagem: imageBuffer, 
        });

        prize = await Prize.findOne({
          where: { game_id: currentGame.id },
          include: [{
            model: PrizeImage,
            as: 'imagens',
            attributes: ['id', 'imagem'],
          }]
        });
      }

      const imagensComId = prize?.imagens?.map(img => ({
        id: img.id,
        imagem: `data:image/jpeg;base64,${img.imagem.toString('base64')}`
      })) || [];

      io.emit('premio-imagens-atualizado', { imagens: imagensComId });

      res.json({ premio: prize.descricao, imagens: imagensComId });
    } catch (error) {
      console.error('Erro ao buscar jogo atual:', error);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  router.get('/current-game', authenticateToken, async (req, res) => {
    try {
      const { game: currentGame, playersPaidCount } = await loadCurrentGameData();
      res.json({
        id: currentGame.id,
        ativo: currentGame.ativo,
        preco: currentGame.preco,
        playersPaidCount
      });
    } catch (error) {
      console.error('Erro ao buscar jogo atual:', error);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  router.get('/delivery-infos', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const deliveryInfo = await DeliveryInfo.findOne({ where: { user_id: userId } });
      if (!deliveryInfo) {
        return res.status(404).json({ message: 'Nenhuma informação de entrega encontrada.' });
      }
      res.json({
        rua: deliveryInfo.rua,
        numero: deliveryInfo.numero,
        bairro: deliveryInfo.bairro,
        cidade: deliveryInfo.cidade,
        estado: deliveryInfo.estado,
        cep: deliveryInfo.cep
      });
    } catch (error) {
      console.error('Erro ao buscar informações de entrega:', error);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  router.post('/register-winner', verifyAdmin, async (req, res, next) => {
    try {
      const { default: gameController } = await import('../controllers/gameController.js');
      await gameController.registerWinner(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  router.get('/check-payment', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

      if (user.role === 'admin') return res.json({ hasPaid: true });

      const latestGame = await Game.findOne({ order: [['created_at', 'DESC']] });
      if (!latestGame) return res.status(404).json({ message: 'Nenhum jogo encontrado.' });

      const payment = await Payment.findOne({ where: { user_id: userId, game_id: latestGame.id, paid: true } });
      res.json({ hasPaid: !!payment });
    } catch (err) {
      console.error('Erro ao verificar pagamento:', err);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  router.post('/pay', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      await registrarPagamentoBanco({
        userId,
        amount: req.body.amount,
        endereco: req.body,
        formaPagamento: req.body.formaPagamento,
        io
      });
      res.json({ message: 'Pagamento registrado com sucesso!' });
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  router.post('/create-payment-intent', authenticateToken,  async (req, res) => {
    try {
      const { amount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'brl',
        automatic_payment_methods: {
          enabled: true 
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
      console.error('Erro Stripe:', err);
      res.status(500).json({ error: 'Erro ao criar pagamento' });
    }
  });

  router.post('/confirmar-pagamento-cartao', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const { valor, endereco, coupon_code, influencer_id, discount_percent, comission } = req.body;

      const { game: currentGame, playersPaidCount } = await loadCurrentGameData();

      if (!currentGame) {
        return res.status(400).json({ message: 'Jogo ativo não encontrado.' });
      }

      // Atualiza ou cria endereço de entrega
      let deliveryInfo = await DeliveryInfo.findOne({ where: { user_id: userId } });
      if (deliveryInfo) {
        await deliveryInfo.update({ rua: endereco.rua, numero: endereco.numero, bairro: endereco.bairro, cidade: endereco.cidade, estado: endereco.estado, cep: endereco.cep });
      } else {
        await DeliveryInfo.create({ user_id: userId, game_id: currentGame.id, rua: endereco.rua, numero: endereco.numero, bairro: endereco.bairro, cidade: endereco.cidade, estado: endereco.estado, cep: endereco.cep });
      }
      
      let pagamento = await Payment.findOne({ where: { user_id: userId, game_id: currentGame.id, paid: true } });
      if (pagamento) {
        return res.status(200).json({ message: 'Pagamento já registrado anteriormente.' });
      }

      // Cria o registro de pagamento
      pagamento = await Payment.create({
        user_id: userId,
        game_id: currentGame.id,
        amount: valor,
        payment_method: 'cartao',
        paid: true,
        paid_at: new Date(),
        coupon_code: coupon_code || null,
        influencer_id: influencer_id,
        discount: discount_percent,
        commission_amount: comission > 0 ? comission : null
      });

      // Adiciona ao Redis e emite update
      await redisClient.sAdd(`playersPaidGame:${currentGame.id}`, userId.toString());
      io.emit('players-paid-count', { current: playersPaidCount + 1, min: currentGame.min_players });

      return res.status(200).json({ message: 'Pagamento confirmado e salvo com sucesso.' });
    } catch (err) {
      console.error('Erro ao confirmar pagamento com cartão:', err);
      return res.status(500).json({ message: 'Erro ao confirmar pagamento.' });
    }
  });

  router.post('/efi/gerar-pix', authenticateToken, async (req, res) => {
    try {
      const { valor, endereco, coupon_code, influencer_id, discount_percent, comission } = req.body; 

      const user = await User.findOne({ where: { email: req.user.email } });

      if (!user)  return res.status(404).json({ message: 'Usuário não encontrado.' });
      if (!user.name) return res.status(400).json({ message: 'Nome obrigatório.' });
      if (!user.cpf)  return res.status(400).json({ message: 'CPF obrigatório.' });
      
      let currentGame = await Game.findOne({
        order: [['created_at', 'DESC']]
      });

      const numValor = Number(valor);
      if (isNaN(numValor) || numValor <= 0)
        return res.status(400).json({ message: 'Valor inválido.' });

      const { rua, numero, bairro, cidade, estado, cep, telefone } = endereco;

      if (telefone) {
        user.phone = `+55${telefone}`;
        await user.save();
      }

      let deliveryInfo = await DeliveryInfo.findOne({ where: { user_id: user.id } });
      if (deliveryInfo) {
        await deliveryInfo.update({ rua, numero, bairro, cidade, estado, cep });
      } else {
        await DeliveryInfo.create({ user_id: user.id, game_id: currentGame.id, rua, numero, bairro, cidade, estado, cep });
      }

      const txid = generateTxid();
      const efi = new EfiService();
      const cobranca = await efi.gerarCobrancaPix(valor, txid, user.cpf, user.name);
      const qr = await efi.gerarQRCode(cobranca.loc.id);

      let payment = await Payment.findOne({ where: { txid: txid } });
      if (!payment) {
        await Payment.create(
          { 
            user_id: user.id, 
            game_id: 
            currentGame.id, 
            txid: txid, 
            amount: numValor, 
            payment_method: 'Pix', 
            paid: false, 
            paid_at: null,
            cupon_code: coupon_code,
            influencer_id: influencer_id,
            comission_amount: comission,
            discount: discount_percent
          });
      }

      res.json({
        txid,
        qrcode: qr.qrcode,
        imagemQrcode: qr.imagemQrcode
      });
    } catch (err) {
      const msg = err?.response?.data?.mensagem || 'Erro ao gerar cobrança PIX';
      console.error('Erro ao gerar cobrança PIX:', msg);
      res.status(500).json({ mensagem: msg });
    }
  });

  router.post("/webhook", verifyEfiWebhook, (request, response) => {
      response.status(200).end();
  });

  router.post('/webhook/pix', verifyEfiWebhook, async (req, res) => {
    try {
      const payload = req.body;

      logger.info('Webhook recebido', { body: payload });

      if (payload.pix && Array.isArray(payload.pix)) {
        for (const pagamento of payload.pix) {
          await pixQueue.add('processar-pix', {
            txid: pagamento.txid,
            valor: pagamento.valor
          });
        }
      }

      res.status(200).send('OK');
    } catch (err) {
      console.error('Erro no webhook Efi:', err);
      res.status(500).send('Erro');
    }
  });

  // Rota para cadastro do webhook
  router.post('/register-webhook', verifyAdmin, async (req, res) => {
    try {
      await cadastrarWebhook();
      res.status(200).send('Webhook cadastrado com sucesso!');
    } catch (err) {
      res.status(500).send('Erro ao cadastrar o webhook');
    }
  });

  router.get('/efi/payment-status/:txid', authenticateToken, async (req, res) => {
    const { txid } = req.params;
    try {
      const payment = await Payment.findOne({ where: { txid: txid } });
      if (!payment) return res.json({ paid: false });
      res.json({ paid: true }); 
    } catch (err) {
      console.error(err);
      res.status(500).json({ paid: false });
    }
  });

  router.get('/logs', verifyAdmin, async (req, res) => {
    try {
      const logs = fs.readFileSync(webhookLogPath, 'utf-8');
      res.type('text/plain').send(logs);
    } catch (err) {
      console.error('Erro ao ler logs:', err);
      res.status(500).send('Erro ao ler logs');
    }
  });

  router.delete('/logs', verifyAdmin, (req, res) => {
    try {
      fs.writeFileSync(webhookLogPath, '', 'utf-8'); // Limpa o conteúdo do log
      res.status(200).json({ message: 'Log do webhook limpo com sucesso!' });
    } catch (err) {
      console.error('Erro ao limpar log do webhook:', err);
      res.status(500).json({ message: 'Erro ao limpar log' });
    }
  });

  router.post('/:gameId/upload-image', verifyAdmin, upload.single('imagem'), async (req, res) => {
    try {
      const { gameId } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

      // Buscar o prêmio associado ao jogo
      const prize = await Prize.findOne({ where: { game_id: gameId } });
      if (!prize) return res.status(404).json({ message: 'Prêmio não encontrado para este jogo' });

      // Criar uma nova imagem vinculada ao prêmio
      await PrizeImage.create({
        prize_id: prize.id,
        imagem: file.buffer
      });

      const imagens = await PrizeImage.findAll({
        where: { prize_id: prize.id },
      });

      const imagensFormatadas = imagens.map(img => ({
        id: img.id,
        imagem: `data:image/jpeg;base64,${img.imagem.toString('base64')}`
      }));

      io.emit('premio-imagens-atualizado', { imagens: imagensFormatadas });

      res.json({ message: 'Imagem salva com sucesso!' });
    } catch (err) {
      console.error('Erro no upload de imagem:', err);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  router.get('/:gameId/images', async (req, res) => {
    try {
      const { gameId } = req.params;

      const prize = await Prize.findOne({ where: { game_id: gameId }, include: [{ model: PrizeImage, as: 'imagens' }] });
      if (!prize) return res.status(404).json({ message: 'Prêmio não encontrado' });
      if (!prize.imagens || prize.imagens.length === 0) return res.status(404).json({ message: 'Nenhuma imagem encontrada' });

      // Converter buffer das imagens para base64
      const imagensBase64 = prize.imagens.map(img => ({
        id: img.id,
        base64: `data:image/png;base64,${img.imagem.toString('base64')}`
      }));

      res.json(imagensBase64);
    } catch (err) {
      console.error('Erro ao buscar imagens:', err);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  router.delete('/image/:imageId', verifyAdmin, async (req, res) => {
    const { imageId } = req.params;
    const { gameId } = req.query;

    if (!imageId || !gameId) {
      return res.status(400).json({ error: 'ID da imagem ou do jogo não foi informado.' });
    }

    try {
      const imagem = await PrizeImage.findByPk(imageId);
      if (!imagem) {
        return res.status(404).json({ error: 'Imagem não encontrada.' });
      }

      await imagem.destroy();

      const prize = await Prize.findOne({ where: { game_id: gameId } });
      if (!prize) {
        return res.status(404).json({ message: 'Prêmio não encontrado para este jogo' });
      }

      const imagens = await PrizeImage.findAll({
        where: { prize_id: prize.id },
      });

      const imagensFormatadas = imagens.map(img => ({
        id: img.id,
        imagem: `data:image/jpeg;base64,${img.imagem.toString('base64')}`
      }));

      io.emit('premio-imagens-atualizado', { imagens: imagensFormatadas });
      res.json({ message: 'Imagem removida com sucesso.' });
    } catch (err) {
      console.error('Erro ao remover imagem:', err);
      res.status(500).json({ error: 'Erro interno ao remover imagem.' });
    }
  });

  router.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      return res.json({ message: 'Senha redefinida com sucesso.' });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ message: 'Token inválido ou expirado.' });
    }
  });

  async function registrarPagamentoBanco({ userId, amount, formaPagamento, io, txid}) {
    const { game: currentGame, playersPaidCount } = await loadCurrentGameData();
    const existingPayment = await Payment.findOne({ where: { user_id: userId, game_id: currentGame.id } });
    if (existingPayment) {
      console.log('Pagamento já registrado para esse usuário e jogo.');
      return;
    }

    if (!currentGame) throw new Error('Jogo inválido');

    const sentAmount = Number(amount);
    const expectedAmount = Number(currentGame.preco);
    if (isNaN(sentAmount) || Math.abs(sentAmount - expectedAmount) > 0.001) {
      throw new Error(`Valor incorreto. Esperado: ${expectedAmount.toFixed(2)} R$.`);
    }

    try {
      const payment = await Payment.create({ user_id: userId, game_id: currentGame.id, amount: expectedAmount, payment_method: formaPagamento, txid: txid});
      logger.info('Pagamento registrado com sucesso', { payment });
    } catch (error) {
      logger.error('Erro ao registrar pagamento', { error });
      throw error;
    }
    
    await redisClient.sAdd(`playersPaidGame:${currentGame.id}`, userId.toString());

    io.emit('players-paid-count', { current: playersPaidCount + 1, min: currentGame.min_players });
  }

  function generateTxid() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const length = 30;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async function cadastrarWebhook() {
    const isProd = process.env.NODE_ENV === 'production';

    const certPath = isProd ? process.env.EFI_CERT_PATH_PRD : process.env.EFI_CERT_PATH_HML;
    const clientId = isProd ? process.env.EFI_CLIENT_ID_PRD : process.env.EFI_CLIENT_ID_HML;
    const clientSecret = isProd ? process.env.EFI_CLIENT_SECRET_PRD : process.env.EFI_CLIENT_SECRET_HML;
    const baseUrl = isProd ? process.env.EFI_URL_PRD : process.env.EFI_URL_HML;
    const myWebhookUrl = process.env.MY_WEBHOOK_URL_EFI;

    const cert = fs.readFileSync(certPath);
    const httpsAgent = new https.Agent({ pfx: cert });

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const tokenRes = await axios.post(
        `${baseUrl}/oauth/token`,
        { grant_type: 'client_credentials' },
        {
          httpsAgent,
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const accessToken = tokenRes.data.access_token;

      console.log(`🔗 URL que será usada no webhook: ${myWebhookUrl}`);
      logger.info(`🔗 URL que será usada no webhook: ${myWebhookUrl}`);
      const response = await axios.put(
        `${baseUrl}/v2/webhook/${process.env.EFI_PIX_KEY}`,
        {
          webhookUrl: myWebhookUrl
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          httpsAgent
        }
      );
      
      console.log('✅ Webhook cadastrado com sucesso:', response.data);
      logger.info('✅ Webhook cadastrado com sucesso:', response.data);
    } catch (err) {
      console.error('❌ Erro ao cadastrar webhook:', err.response?.data || err.message);
      logger.info('❌ Erro ao cadastrar webhook:', err.response?.data || err.message);
    }
  }

  function parsePhone(phone) {
    // Remove tudo que não for número
    const digits = phone.replace(/\D/g, '');

    // Garante pelo menos 10 dígitos (ex: 11912345678)
    if (digits.length < 10) return { area_code: '', number: '' };

    const area_code = digits.slice(0, 2);
    const number = digits.slice(2);

    return { area_code, number };
  }

  return router;
};
