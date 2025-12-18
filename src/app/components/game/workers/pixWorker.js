import '../../../../../env.js';
import { Worker } from 'bullmq';
import redisConnection from '../../../../../redisIoredisClient.js';
import Payment from './../models/payment.js';

const worker = new Worker('pixQueue', async job => {
  const { txid, valor } = job.data;

  const existingPayment = await Payment.findOne({ where: { txid } });

  if (!existingPayment) {
    console.warn('❌ Pagamento não encontrado para txid:', txid);
    return;
  }

  if (existingPayment.paid) {
    console.log('✅ Pagamento já confirmado:', txid);
    return;
  }

  // Atualiza o registro
  existingPayment.amount = parseFloat(valor);
  existingPayment.paid = true;
  existingPayment.paid_at = new Date();
  await existingPayment.save();

  // Publica evento no Redis para que o backend envie via Socket.IO
  await redisConnection.publish('pix-confirmado', JSON.stringify({
    userId: existingPayment.user_id,
    txid: existingPayment.txid,
    paid: true
  }));

  console.log('📦 Pagamento processado com sucesso para txid:', txid);

}, { connection: redisConnection });

worker.on('completed', job => {
  console.log(`✅ Job ${job.id} concluído.`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} falhou:`, err);
});
