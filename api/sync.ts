import { redisGet, redisSet, getRedisConfig } from './_redis';
import { verifySessionToken } from './_auth';

type VercelRequest = any;
type VercelResponse = any;

// Helper to merge two lists by ID keeping the newest version
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

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const session = verifySessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  const userVaultKey = `noteon:userdata:${session.userId}`;

  try {
    // GET: Pull cloud data
    if (req.method === 'GET') {
      const cloudData = await redisGet(userVaultKey);
      return res.status(200).json(
        cloudData || {
          courses: [],
          subjects: [],
          topics: [],
          items: [],
          questions: [],
          lastSyncedAt: Date.now(),
        }
      );
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

      await redisSet(userVaultKey, mergedPayload);

      return res.status(200).json({
        success: true,
        data: mergedPayload,
      });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err: any) {
    console.error('Erro em /api/sync:', err);
    return res.status(500).json({
      error: 'Erro interno ao sincronizar dados',
      message: err.message,
    });
  }
}
