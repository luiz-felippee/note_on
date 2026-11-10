import crypto from 'node:crypto';

// Upstash Redis REST Config & Runner for Cloudflare Pages Functions
const DEFAULT_REDIS_URL = 'https://precise-sheep-187228.upstash.io';
const DEFAULT_REDIS_TOKEN = 'gQAAAAAAAttcAQIgcDFlMzdmODMzM2ZiY2U0ODU5OGMwODU4ZTQ4YmI3ODY1Yg';
const DEFAULT_AUTH_SECRET = 'noteon_super_secret_salt_2026';

interface Env {
  KV_REST_API_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  KV_REST_API_TOKEN?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  NOTEON_AUTH_SECRET?: string;
}

function getRedisConfig(env: Env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || DEFAULT_REDIS_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || DEFAULT_REDIS_TOKEN;
  return { url: url.replace(/\/$/, ''), token };
}

async function redisCommand(env: Env, command: string[]): Promise<any> {
  const { url, token } = getRedisConfig(env);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upstash Redis Error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  return data.result;
}

async function redisGet<T = any>(env: Env, key: string): Promise<T | null> {
  const result = await redisCommand(env, ['GET', key]);
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

async function redisSet(env: Env, key: string, value: any): Promise<string> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return await redisCommand(env, ['SET', key, serialized]);
}

// Crypto & Session Token Helpers
function getAuthSecret(env: Env): string {
  return env.NOTEON_AUTH_SECRET || DEFAULT_AUTH_SECRET;
}

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

function createSessionToken(userId: string, email: string, secret: string): string {
  const exp = Date.now() + 180 * 24 * 60 * 60 * 1000; // 180 days
  const payload: SessionPayload = { userId, email, exp };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string, secret: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  let action = url.searchParams.get('action');

  let body: any = null;
  if (request.method === 'POST') {
    try {
      body = await request.json();
      if (!action && body?.action) {
        action = body.action;
      }
    } catch (_) {
      body = {};
    }
  }

  const secret = getAuthSecret(env);

  try {
    // 1. REGISTER
    if (request.method === 'POST' && action === 'register') {
      const { email, password } = body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 4) {
        return jsonResponse(
          { error: 'Informe um e-mail válido e uma senha com pelo menos 4 caracteres.' },
          400
        );
      }

      const userKey = `noteon:user:${cleanEmail}`;
      const existingUser = await redisGet(env, userKey);

      if (existingUser) {
        return jsonResponse(
          { error: 'Este e-mail já está cadastrado. Clique em Entrar para fazer login.' },
          409
        );
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

      await redisSet(env, userKey, userData);
      const token = createSessionToken(userId, cleanEmail, secret);

      return jsonResponse(
        {
          success: true,
          user: { userId, email: cleanEmail },
          token,
        },
        201
      );
    }

    // 2. LOGIN
    if (request.method === 'POST' && action === 'login') {
      const { email, password } = body || {};
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail || !password) {
        return jsonResponse({ error: 'Informe e-mail e senha.' }, 400);
      }

      const userKey = `noteon:user:${cleanEmail}`;
      const user = await redisGet(env, userKey);

      if (!user || !user.passwordHash || !user.salt) {
        return jsonResponse(
          {
            error:
              'Conta não encontrada com este e-mail. Se for seu primeiro acesso, clique na aba "Criar Conta".',
          },
          401
        );
      }

      const expectedHash = hashPassword(password, user.salt);
      if (expectedHash !== user.passwordHash) {
        return jsonResponse({ error: 'Senha incorreta. Verifique e tente novamente.' }, 401);
      }

      const token = createSessionToken(user.userId, user.email, secret);

      return jsonResponse({
        success: true,
        user: { userId: user.userId, email: user.email },
        token,
      });
    }

    // 3. ME (Session check)
    if (request.method === 'GET' && action === 'me') {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/, '').trim();
      const session = verifySessionToken(token, secret);

      if (!session) {
        return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
      }

      return jsonResponse({
        user: { userId: session.userId, email: session.email },
      });
    }

    return jsonResponse(
      { error: 'Ação inválida. Use action=login ou action=register.' },
      400
    );
  } catch (err: any) {
    console.error('Erro em /api/auth no Cloudflare Pages:', err);
    return jsonResponse(
      {
        error: 'Erro interno no servidor de autenticação',
        message: err.message,
      },
      500
    );
  }
}

