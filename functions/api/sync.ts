import crypto from 'node:crypto';

const DEFAULT_AUTH_SECRET = 'noteon_super_secret_salt_2026';

interface D1Database {
  prepare(query: string): any;
  batch(statements: any[]): Promise<any[]>;
}

interface KVNamespace {
  get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  DB?: D1Database;
  NOTEON_KV?: KVNamespace;
  NOTEON_AUTH_SECRET?: string;
  [key: string]: any;
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

// Auto-migration helper from legacy KV to D1 on first access
async function ensureMigratedFromKvToD1(env: Env, userId: string): Promise<void> {
  if (!env.DB || !env.NOTEON_KV) return;

  try {
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM sync_entities WHERE userId = ?'
    )
      .bind(userId)
      .first();

    if (countRow && countRow.count > 0) return;

    // Read existing KV vault
    const rawVault = await env.NOTEON_KV.get(`noteon:userdata:${userId}`, 'text');
    if (!rawVault) return;

    const kvData = JSON.parse(rawVault);
    const now = Date.now();
    const deletedSet = new Set<string>(kvData.deletedIds || []);

    const statements: any[] = [];

    // Migrate tombstoned items
    for (const id of deletedSet) {
      statements.push(
        env.DB.prepare(
          'INSERT OR IGNORE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(userId, id, 'tombstone', '{}', now, now)
      );
    }

    // Migrate active entities
    const types = ['courses', 'subjects', 'topics', 'items', 'questions'] as const;
    for (const type of types) {
      const list = kvData[type] || [];
      for (const item of list) {
        if (!item || !item.id || deletedSet.has(item.id)) continue;
        const itemUpdated = item.updatedAt || item.createdAt || now;
        statements.push(
          env.DB.prepare(
            'INSERT OR IGNORE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL)'
          ).bind(userId, item.id, type, JSON.stringify(item), itemUpdated)
        );
      }
    }

    if (statements.length > 0) {
      // Execute in chunks of 50 statements
      for (let i = 0; i < statements.length; i += 50) {
        await env.DB.batch(statements.slice(i, i + 50));
      }
    }
  } catch (err) {
    console.warn('Erro na migração KV -> D1:', err);
  }
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

  const userId = session.userId;

  try {
    // Se D1 estiver disponível, usamos D1 com consistência forte
    if (env.DB) {
      await ensureMigratedFromKvToD1(env, userId);

      const url = new URL(request.url);
      const isCheckOnly =
        url.searchParams.get('check') === 'true' || url.searchParams.get('check') === '1';

      // 1. Lightweight Check (retorna apenas o último timestamp)
      if (request.method === 'GET' && isCheckOnly) {
        const row = await env.DB.prepare(
          'SELECT MAX(updatedAt) as maxUpdated FROM sync_entities WHERE userId = ?'
        )
          .bind(userId)
          .first();

        return jsonResponse({
          success: true,
          lastSyncedAt: Number(row?.maxUpdated) || 0,
        });
      }

      // 2. POST: Inserir alterações, aplicar tombstones e mesclar
      if (request.method === 'POST') {
        let clientData: any = {};
        try {
          clientData = await request.json();
        } catch (_) {
          clientData = {};
        }

        const now = Date.now();
        const clientDeletedIds: string[] = clientData.deletedIds || [];
        const statements: any[] = [];

        // A. Aplicar exclusões: A EXCLUSÃO SEMPRE VENCE!
        for (const id of clientDeletedIds) {
          if (!id) continue;
          statements.push(
            env.DB.prepare(
              `INSERT INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt)
               VALUES (?, ?, 'tombstone', '{}', ?, ?)
               ON CONFLICT (userId, entityId)
               DO UPDATE SET deletedAt = excluded.deletedAt, updatedAt = excluded.updatedAt`
            ).bind(userId, id, now, now)
          );
        }

        // B. Inserir ou atualizar entidades ativas
        const types = ['courses', 'subjects', 'topics', 'items', 'questions'] as const;
        for (const type of types) {
          const list = clientData[type] || [];
          for (const item of list) {
            if (!item || !item.id) continue;
            // Pula se já estiver no conjunto de IDs deletados enviado
            if (clientDeletedIds.includes(item.id)) continue;

            const itemUpdated = item.updatedAt || item.createdAt || now;
            statements.push(
              env.DB.prepare(
                `INSERT INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt)
                 VALUES (?, ?, ?, ?, ?, NULL)
                 ON CONFLICT (userId, entityId)
                 DO UPDATE SET
                   data = excluded.data,
                   entityType = excluded.entityType,
                   updatedAt = excluded.updatedAt
                 WHERE sync_entities.deletedAt IS NULL`
              ).bind(userId, item.id, type, JSON.stringify(item), itemUpdated)
            );
          }
        }

        if (statements.length > 0) {
          for (let i = 0; i < statements.length; i += 60) {
            await env.DB.batch(statements.slice(i, i + 60));
          }
        }
      }

      // 3. Montar e retornar o estado completo atualizado do D1
      const allRows = await env.DB.prepare(
        'SELECT entityType, entityId, data, updatedAt, deletedAt FROM sync_entities WHERE userId = ?'
      )
        .bind(userId)
        .all();

      const courses: any[] = [];
      const subjects: any[] = [];
      const topics: any[] = [];
      const items: any[] = [];
      const questions: any[] = [];
      const deletedIds: string[] = [];

      let maxUpdated = 0;

      for (const row of allRows.results || []) {
        if (row.updatedAt > maxUpdated) {
          maxUpdated = row.updatedAt;
        }

        // Se estiver marcado como deletado
        if (row.deletedAt) {
          deletedIds.push(row.entityId);
          continue;
        }

        // Se for ativo, desserializa e classifica pelo tipo
        try {
          const parsed = JSON.parse(row.data);
          if (row.entityType === 'courses') courses.push(parsed);
          else if (row.entityType === 'subjects') subjects.push(parsed);
          else if (row.entityType === 'topics') topics.push(parsed);
          else if (row.entityType === 'items') items.push(parsed);
          else if (row.entityType === 'questions') questions.push(parsed);
        } catch (_) {}
      }

      return jsonResponse({
        success: true,
        data: {
          courses,
          subjects,
          topics,
          items,
          questions,
          deletedIds: Array.from(new Set(deletedIds)),
          lastSyncedAt: maxUpdated || Date.now(),
        },
      });
    }

    return jsonResponse({ error: 'Banco D1 não configurado.' }, 500);
  } catch (err: any) {
    console.error('Erro em /api/sync no Cloudflare D1:', err);
    return jsonResponse(
      {
        error: 'Erro interno ao sincronizar dados no D1',
        message: err.message,
      },
      500
    );
  }
}
