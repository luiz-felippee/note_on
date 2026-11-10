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

// Session Token Verification
const AUTH_SECRET = process.env.NOTEON_AUTH_SECRET || 'noteon_super_secret_salt_2026';

interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers?.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const session = verifySessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Sessão não autorizada ou expirada. Faça login novamente.' });
  }

  const userVaultKey = `noteon:userdata:${session.userId}`;
  const userVersionKey = `noteon:userver:${session.userId}`;

  try {
    // GET: Pull cloud data or check version
    if (req.method === 'GET') {
      const isCheckOnly = req.query?.check === 'true' || req.query?.check === '1';
      if (isCheckOnly) {
        let version = await redisGet(userVersionKey);
        if (!version) {
          const fullData = await redisGet(userVaultKey);
          version = fullData?.lastSyncedAt || 0;
        }
        return res.status(200).json({
          success: true,
          lastSyncedAt: Number(version) || 0,
        });
      }

      const cloudData = await redisGet(userVaultKey);
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

      return res.status(200).json({
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
    if (req.method === 'POST') {
      const clientData = req.body || {};
      const cloudData = (await redisGet(userVaultKey)) || {
        courses: [],
        subjects: [],
        topics: [],
        items: [],
        questions: [],
        deletedIds: [],
      };

      const allDeletedIds = new Set<string>([
        ...(cloudData.deletedIds || []),
        ...(clientData.deletedIds || []),
      ]);

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
        redisSet(userVaultKey, mergedPayload),
        redisSet(userVersionKey, now),
      ]);

      return res.status(200).json({
        success: true,
        data: mergedPayload,
      });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err: any) {
    console.error('Erro em /api/sync:', err);
    return res.status(500).json({
      error: 'Erro interno ao sincronizar dados na nuvem',
      message: err.message,
    });
  }
}
