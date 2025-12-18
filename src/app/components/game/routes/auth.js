import '../../../../../env.js';
import express from 'express';
const router = express.Router();
import User from '../models/user.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendResetPasswordEmail } from '../email.service.js';
import authenticateToken from '../middlewares/auth.js';

// 🔐 Rota protegida de exemplo
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ✅ Registro
router.post('/register', async (req, res) => {
  const { name, email, password, cpf } = req.body;

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Usuário já existe' });
    }

    if (!cpf) {
      return res.status(400).json({ message: 'CPF é obrigatório' });
    }

    const cleanedCpf = cpf.replace(/\D/g, '');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword, cpf: cleanedCpf });

    const token = jwt.sign({ id: newUser.id, email, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.status(201).json({ token });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// ✅ Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Senha inválida' });

    const token = jwt.sign({ id: user.id, email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado' });
  }

  const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '15m' });

  await sendResetPasswordEmail(user.email, token);

  return res.json({ message: 'Email de recuperação enviado.' });
});

router.post('/reset-password', async (req, res) => {
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

export default router;
