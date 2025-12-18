import jwt from 'jsonwebtoken';

export default function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  // Se não houver header Authorization, retorna 401
  if (!authHeader) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  // Extrai token do formato "Bearer TOKEN"
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token malformado' });
  }

  try {
    // Verifica e decodifica token usando secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verifica role 'admin'
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso restrito a administradores' });
    }

    // Anexa dados do usuário no request para uso posterior
    req.user = decoded;
    next();
  } catch (err) {
    // Token inválido ou expirado
    return res.status(401).json({ message: 'Token inválido' });
  }
};
