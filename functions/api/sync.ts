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

// Session Token Verification
function getAuthSecret(env: Env): string {
  return env.NOTEON_AUTH_SECRET || DEFAULT_AUTH_SECRET;
}

interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
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

// Merge entity lists keeping the latest version
function mergeEntityLists<T extends { id: string; updatedAt?: number; createdAt?: number }>(
  serverList: T[] = [],
  clientList: T[] = []
): T[] {
  const map = new Map<string, T>();

  for (const item of serverList || []) {
    if (item && item.id) map.set(item.id, item);
  }

  for (const item of clientList || []) {
    if (!item || !item.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const clientTime = item.updatedAt || item.createdAt || 0;
      const serverTime = existing.updatedAt || existing.createdAt || 0;
      if (clientTime >= serverTime) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
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

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const secret = getAuthSecret(env);
  const session = verifySessionToken(token, secret);

  if (!session) {
    return jsonResponse(
      { error: 'Sessão não autorizada ou expirada. Faça login novamente.' },
      401
    );
  }

  const userVaultKey = `noteon:userdata:${session.userId}`;

  try {
    // GET: Pull cloud data
    if (request.method === 'GET') {
      const cloudData = await redisGet(env, userVaultKey);
      return jsonResponse({
        success: true,
        data: cloudData || {
          courses: [],
          subjects: [],
          topics: [],
          items: [],
          questions: [],
          lastSyncedAt: Date.now(),
        },
      });
    }

    // POST: Push local data & merge
    if (request.method === 'POST') {
      let clientData: any = {};
      try {
        clientData = await request.json();
      } catch (_) {
        clientData = {};
      }

      const cloudData = (await redisGet(env, userVaultKey)) || {
        courses: [],
        subjects: [],
        topics: [],
        items: [],
        questions: [],
      };

      const mergedCourses = mergeEntityLists(cloudData.courses, clientData.courses);
      const mergedSubjects = mergeEntityLists(cloudData.subjects, clientData.subjects);
      const mergedTopics = mergeEntityLists(cloudData.topics, clientData.topics);
      const mergedItems = mergeEntityLists(cloudData.items, clientData.items);
      const mergedQuestions = mergeEntityLists(cloudData.questions, clientData.questions);

      const mergedPayload = {
        courses: mergedCourses,
        subjects: mergedSubjects,
        topics: mergedTopics,
        items: mergedItems,
        questions: mergedQuestions,
        lastSyncedAt: Date.now(),
      };

      await redisSet(env, userVaultKey, mergedPayload);

      return jsonResponse({
        success: true,
        data: mergedPayload,
      });
    }

    return jsonResponse({ error: 'Método não permitido.' }, 405);
  } catch (err: any) {
    console.error('Erro em /api/sync no Cloudflare Pages:', err);
    return jsonResponse(
      {
        error: 'Erro interno ao sincronizar dados na nuvem',
        message: err.message,
      },
      500
    );
  }
}

