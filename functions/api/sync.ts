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
  const userVersionKey = `noteon:userver:${session.userId}`;

  try {
    // GET: Pull cloud data or lightweight version check
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const isCheckOnly = url.searchParams.get('check') === 'true' || url.searchParams.get('check') === '1';

      if (isCheckOnly) {
        let version = await storeGet<number>(env, userVersionKey);
        if (!version) {
          const fullData = await storeGet(env, userVaultKey);
          version = fullData?.lastSyncedAt || 0;
        }
        return jsonResponse({
          success: true,
          lastSyncedAt: Number(version) || 0,
        });
      }

      const cloudData = await storeGet(env, userVaultKey);
      if (cloudData) {
        const deletedSet = new Set<string>(cloudData.deletedIds || []);
        if (deletedSet.size > 0) {
          cloudData.courses = (cloudData.courses || []).filter((i: any) => !deletedSet.has(i.id));
          cloudData.subjects = (cloudData.subjects || []).filter((i: any) => !deletedSet.has(i.id));
          cloudData.topics = (cloudData.topics || []).filter((i: any) => !deletedSet.has(i.id));
          cloudData.items = (cloudData.items || []).filter((i: any) => !deletedSet.has(i.id));
          cloudData.questions = (cloudData.questions || []).filter((i: any) => !deletedSet.has(i.id));
        }
      }

      return jsonResponse({
        success: true,
        data: cloudData || {
          courses: [],
          subjects: [],
          topics: [],
          items: [],
          questions: [],
          deletedIds: [],
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

      const cloudData = (await storeGet(env, userVaultKey)) || {
        courses: [],
        subjects: [],
        topics: [],
        items: [],
        questions: [],
        deletedIds: [],
      };

      // 1. Unir tombstones de exclusão
      const allDeletedIds = new Set<string>([
        ...(cloudData.deletedIds || []),
        ...(clientData.deletedIds || []),
      ]);

      // 2. Mesclar entidades descartando qualquer item que foi excluído
      const filterNotDeleted = <T extends { id: string }>(list: T[] = []) =>
        list.filter((item) => item && item.id && !allDeletedIds.has(item.id));

      const mergedCourses = filterNotDeleted(mergeEntityLists(cloudData.courses, clientData.courses));
      const mergedSubjects = filterNotDeleted(mergeEntityLists(cloudData.subjects, clientData.subjects));
      const mergedTopics = filterNotDeleted(mergeEntityLists(cloudData.topics, clientData.topics));
      const mergedItems = filterNotDeleted(mergeEntityLists(cloudData.items, clientData.items));
      const mergedQuestions = filterNotDeleted(mergeEntityLists(cloudData.questions, clientData.questions));

      const now = Date.now();
      const mergedPayload = {
        courses: mergedCourses,
        subjects: mergedSubjects,
        topics: mergedTopics,
        items: mergedItems,
        questions: mergedQuestions,
        deletedIds: Array.from(allDeletedIds).slice(-3000),
        lastSyncedAt: now,
      };

      await Promise.all([
        storeSet(env, userVaultKey, mergedPayload),
        storeSet(env, userVersionKey, now),
      ]);

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
