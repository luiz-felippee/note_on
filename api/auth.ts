import crypto from 'node:crypto';

// Upstash Redis REST Config & Runner
const REDIS_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  'https://precise-sheep-187228.upstash.io';
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  'gQAAAAAAAttcAQIgcDFlMzdmODMzM2ZiY2U0ODU5OGMwODU4ZTQ4YmI3ODY1Yg';

async function redisCommand(command: string[]): Promise<any> {
  const url = REDIS_URL.replace(/\/$/, '');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upstash Redis Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.result;
}

async function redisGet<T = any>(key: string): Promise<T | null> {
  const result = await redisCommand(['GET', key]);
  if (!result) return null;
  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return result as unknown as T;
    }
  }
  return result;
}

async function redisSet(key: string, value: any): Promise<string> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return await redisCommand(['SET', key, serialized]);
}

// Crypto & Session Token Helpers
const AUTH_SECRET = process.env.NOTEON_AUTH_SECRET || 'noteon_super_secret_salt_2026';

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
}

function createSessionToken(userId: string, email: string): string {
  const exp = Date.now() + 180 * 24 * 60 * 60 * 1000; // 180 days
  const payload: SessionPayload = { userId, email, exp };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(encodedPayload)
      .digest('base64url');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    );

    if (payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Serverless Handler
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query?.action || req.body?.action;

  try {
    // 1. REGISTER
    if (req.method === 'POST' && action === 'register') {
      const { email, password } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 4) {
        return res.status(400).json({
          error: 'Informe um e-mail válido e uma senha com pelo menos 4 caracteres.',
        });
      }

      const userKey = `noteon:user:${cleanEmail}`;
      const existingUser = await redisGet(userKey);

      if (existingUser) {
        return res.status(409).json({
          error: 'Este e-mail já está cadastrado. Clique em Entrar para fazer login.',
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
        return res.status(401).json({
          error: 'Conta não encontrada com este e-mail. Se for seu primeiro acesso, clique na aba "Criar Conta".',
        });
      }

      const expectedHash = hashPassword(password, user.salt);
      if (expectedHash !== user.passwordHash) {
        return res.status(401).json({ error: 'Senha incorreta. Verifique e tente novamente.' });
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
      const authHeader = req.headers?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/, '').trim();
      const session = verifySessionToken(token);

      if (!session) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      }

      return res.status(200).json({
        user: { userId: session.userId, email: session.email },
      });
    }

    return res.status(400).json({ error: 'Ação inválida. Use action=login ou action=register.' });
  } catch (err: any) {
    console.error('Erro em /api/auth:', err);
    return res.status(500).json({
      error: 'Erro interno no servidor de autenticação',
      message: err.message,
    });
  }
}
