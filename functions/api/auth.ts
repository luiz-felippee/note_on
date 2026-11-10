import crypto from 'node:crypto';

const DEFAULT_AUTH_SECRET = 'noteon_super_secret_salt_2026';

interface KVNamespace {
  get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  NOTEON_KV?: KVNamespace;
  NOTEON_AUTH_SECRET?: string;
  [key: string]: any;
}

// In-memory fallback
const inMemoryStore = new Map<string, any>();

async function storeGet<T = any>(env: Env, key: string): Promise<T | null> {
  if (env?.NOTEON_KV) {
    try {
      const val = await env.NOTEON_KV.get(key, 'text');
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val as unknown as T;
      }
    } catch (e) {
      console.warn('Erro ao ler NOTEON_KV:', e);
    }
  }

  const memoryVal = inMemoryStore.get(key);
  return memoryVal ? (memoryVal as T) : null;
}

async function storeSet(env: Env, key: string, value: any): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (env?.NOTEON_KV) {
    try {
      await env.NOTEON_KV.put(key, serialized);
      return;
    } catch (e) {
      console.warn('Erro ao salvar em NOTEON_KV:', e);
    }
  }

  inMemoryStore.set(key, typeof value === 'string' ? JSON.parse(value) : value);
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
      const existingUser = await storeGet(env, userKey);

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

      await storeSet(env, userKey, userData);
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
      const user = await storeGet(env, userKey);

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
