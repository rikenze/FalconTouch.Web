// Middleware para verificar Webhook
export function verifyEfiWebhook(req, res, next) {
  try {
    if (!req.socket || typeof req.socket.getPeerCertificate !== 'function') {
      console.warn('⚠️ req.socket.getPeerCertificate não disponível. Pule a validação mTLS');
      return next();
    }

    const cert = req.socket.getPeerCertificate();

    // Se não enviou certificado, erro 401
    if (!cert || Object.keys(cert).length === 0) {
      console.warn('[EFI-WebHook] ❌ Certificado do cliente ausente ou inválido');
      return res.status(401).send('Certificado cliente não fornecido');
    }

    // Validação simples do CN para verificar se é certificado da Efipay/Gerencianet
    const cn = cert.subject?.CN || '';
    if (!cn.toLowerCase().includes('efipay') && !cn.toLowerCase().includes('gerencianet')) {
      console.warn(`[EFI-WebHook] ❌ Certificado CN inválido: ${cn}`);
      return res.status(403).send('Certificado cliente inválido');
    }

    console.log('[EFI-WebHook] ✅ Certificado cliente válido:', cn);
    next();
  } catch (err) {
    console.error('[EFI-WebHook] Erro na validação do certificado:', err);
    return res.status(500).send('Erro interno na verificação do certificado');
  }
}