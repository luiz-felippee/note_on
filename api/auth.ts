import { redisGet, redisSet, getRedisConfig } from './_redis';
import {
  generateSalt,
  hashPassword,
  createSessionToken,
  verifySessionToken,
} from './_auth';

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { isConfigured } = getRedisConfig();
  if (!isConfigured) {
    return res.status(503).json({
      error: 'REDIS_NOT_CONFIGURED',
      message:
        'O banco de dados Upstash / Vercel KV ainda não foi vinculado na Vercel. Acesse a aba Storage no painel da Vercel e adicione o KV em 1 clique.',
    });
  }

  const action = req.query.action || (req.body && req.body.action);

  try {
    // 1. REGISTER
    if (req.method === 'POST' && action === 'register') {
      const { email, password } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 6) {
        return res.status(400).json({
          error: 'E-mail inválido ou senha com menos de 6 caracteres.',
        });
      }

      const userKey = `noteon:user:${cleanEmail}`;
      const existingUser = await redisGet(userKey);

      if (existingUser) {
        return res.status(409).json({
          error: 'Este e-mail já está cadastrado. Faça login.',
        });
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);
      const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const userData = {
        userId,
        email: cleanEmail,
        salt,
        passwordHash,
        createdAt: Date.now(),
      };

      await redisSet(userKey, userData);

      const token = createSessionToken(userId, cleanEmail);

      return res.status(201).json({
        success: true,
        user: { userId, email: cleanEmail },
        token,
      });
    }

    // 2. LOGIN
    if (req.method === 'POST' && action === 'login') {
      const { email, password } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail || !password) {
        return res.status(400).json({ error: 'Informe e-mail e senha.' });
      }

      const userKey = `noteon:user:${cleanEmail}`;
      const user = await redisGet(userKey);

      if (!user || !user.passwordHash || !user.salt) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }

      const expectedHash = hashPassword(password, user.salt);
      if (expectedHash !== user.passwordHash) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }

      const token = createSessionToken(user.userId, user.email);

      return res.status(200).json({
        success: true,
        user: { userId: user.userId, email: user.email },
        token,
      });
    }

    // 3. ME (Session check)
    if (req.method === 'GET' && action === 'me') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/, '').trim();
      const session = verifySessionToken(token);

      if (!session) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      }

      return res.status(200).json({
        user: { userId: session.userId, email: session.email },
      });
    }

    return res.status(404).json({ error: 'Ação não encontrada.' });
  } catch (err: any) {
    console.error('Erro em /api/auth:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message,
    });
  }
}
