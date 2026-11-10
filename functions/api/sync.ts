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

function getCanonicalUserId(cleanEmail: string): string {
  const hash = crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 20);
  return `usr_${hash}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
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

const CHUNK_SIZE = 38000; // 38 KB per chunk (well below D1's 100 KB statement limit)
const EXTERNAL_MEDIA_MARKER = '__D1_MEDIA__';

async function saveMediaChunks(
  env: Env,
  userId: string,
  entityId: string,
  dataUrl: string,
  now: number
): Promise<void> {
  if (!dataUrl) return;

  // 1. Save in KV if available (supports up to 25 MB per value)
  if (env.NOTEON_KV) {
    try {
      await env.NOTEON_KV.put(`noteon:media:${userId}:${entityId}`, dataUrl);
    } catch (_) {}
  }

  // 2. Also save in D1 media_blobs in 38 KB chunks for strong consistency
  if (env.DB) {
    try {
      await env.DB.prepare('DELETE FROM media_blobs WHERE userId = ? AND mediaId LIKE ?')
        .bind(userId, `${entityId}#%`)
        .run();

      const statements: any[] = [];
      const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
      for (let idx = 0; idx < totalChunks; idx++) {
        const chunk = dataUrl.slice(idx * CHUNK_SIZE, (idx + 1) * CHUNK_SIZE);
        const paddedIdx = String(idx).padStart(4, '0');
        statements.push(
          env.DB.prepare(
            'INSERT OR REPLACE INTO media_blobs (userId, mediaId, dataUrl, createdAt) VALUES (?, ?, ?, ?)'
          ).bind(userId, `${entityId}#${paddedIdx}`, chunk, now)
        );
      }

      for (let i = 0; i < statements.length; i += 10) {
        await env.DB.batch(statements.slice(i, i + 10));
      }
    } catch (e) {
      console.warn('Aviso ao salvar chunks de mídia no D1:', e);
    }
  }
}

async function loadAllMediaForUser(env: Env, userId: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!env.DB) return result;

  try {
    const rows = await env.DB.prepare(
      'SELECT mediaId, dataUrl FROM media_blobs WHERE userId = ? ORDER BY mediaId ASC'
    )
      .bind(userId)
      .all();

    const chunksByEntity = new Map<string, string[]>();
    for (const r of rows.results || []) {
      const mId: string = r.mediaId || '';
      const hashIdx = mId.lastIndexOf('#');
      const entityId = hashIdx !== -1 ? mId.slice(0, hashIdx) : mId;
      let list = chunksByEntity.get(entityId);
      if (!list) {
        list = [];
        chunksByEntity.set(entityId, list);
      }
      list.push(r.dataUrl || '');
    }

    for (const [entityId, chunks] of chunksByEntity.entries()) {
      result.set(entityId, chunks.join(''));
    }
  } catch (e) {
    console.warn('Aviso ao ler chunks de mídia do D1:', e);
  }

  return result;
}

// Auto-migration helper from legacy userId or KV to canonical D1 userId
async function ensureAccountNormalizedAndMigrated(
  env: Env,
  canonicalUserId: string,
  legacyUserId: string
): Promise<void> {
  if (!env.DB) return;

  try {
    // 1. If legacyUserId in token differs from canonicalUserId, migrate its rows in D1
    if (legacyUserId && legacyUserId !== canonicalUserId) {
      await env.DB.prepare('UPDATE OR IGNORE sync_entities SET userId = ? WHERE userId = ?')
        .bind(canonicalUserId, legacyUserId)
        .run();
      await env.DB.prepare('UPDATE OR IGNORE media_blobs SET userId = ? WHERE userId = ?')
        .bind(canonicalUserId, legacyUserId)
        .run();
    }

    // 2. Check if canonicalUserId already has rows in D1
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM sync_entities WHERE userId = ?'
    )
      .bind(canonicalUserId)
      .first();

    if (countRow && Number(countRow.count) > 0) return;

    // 3. Migrate from KV if available
    if (env.NOTEON_KV) {
      const rawVault =
        (await env.NOTEON_KV.get(`noteon:userdata:${canonicalUserId}`, 'text')) ||
        (legacyUserId ? await env.NOTEON_KV.get(`noteon:userdata:${legacyUserId}`, 'text') : null);

      if (!rawVault) return;

      const kvData = JSON.parse(rawVault);
      const now = Date.now();
      const deletedSet = new Set<string>(kvData.deletedIds || []);

      for (const id of deletedSet) {
        if (!id) continue;
        try {
          await env.DB.prepare(
            'INSERT OR IGNORE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?)'
          )
            .bind(canonicalUserId, id, 'tombstone', '{}', now, now)
            .run();
        } catch (_) {}
      }

      const types = ['courses', 'subjects', 'topics', 'items', 'questions'] as const;
      for (const type of types) {
        const list = kvData[type] || [];
        for (const item of list) {
          if (!item || !item.id || deletedSet.has(item.id)) continue;
          const itemUpdated = Number(item.updatedAt || item.createdAt || now);
          const itemCopy = { ...item };

          if (itemCopy.mediaDataUrl && itemCopy.mediaDataUrl.length > 20000) {
            await saveMediaChunks(env, canonicalUserId, itemCopy.id, itemCopy.mediaDataUrl, now);
            itemCopy.mediaDataUrl = EXTERNAL_MEDIA_MARKER;
          }

          try {
            await env.DB.prepare(
              'INSERT OR IGNORE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL)'
            )
              .bind(canonicalUserId, itemCopy.id, type, JSON.stringify(itemCopy), itemUpdated)
              .run();
          } catch (_) {}
        }
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

  const cleanEmail = (session.email || '').trim().toLowerCase();
  const userId = cleanEmail ? getCanonicalUserId(cleanEmail) : session.userId;

  try {
    if (env.DB) {
      await ensureAccountNormalizedAndMigrated(env, userId, session.userId);

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

      // Ler estado atual do D1 antes de aplicar alterações para fazer diff inteligente
      const existingQuery = await env.DB.prepare(
        'SELECT entityId, entityType, data, updatedAt, deletedAt FROM sync_entities WHERE userId = ?'
      )
        .bind(userId)
        .all();

      const existingMap = new Map<
        string,
        { entityType: string; data: string; updatedAt: number; deletedAt: number | null }
      >();
      for (const r of existingQuery.results || []) {
        existingMap.set(r.entityId, {
          entityType: r.entityType,
          data: r.data,
          updatedAt: Number(r.updatedAt) || 0,
          deletedAt: r.deletedAt ? Number(r.deletedAt) : null,
        });
      }

      // 2. POST: Inserir apenas diferenças reais e aplicar tombstones
      if (request.method === 'POST') {
        let clientData: any = {};
        try {
          clientData = await request.json();
        } catch (_) {
          clientData = {};
        }

        const now = Date.now();

        // Upload direto vindo da Extensão do Chrome (de qualquer computador!)
        if (clientData.action === 'extension_upload' && clientData.dataUrl) {
          let activeCourse: any = null;
          let activeSubject: any = null;
          let activeTopic: any = null;

          for (const [, entry] of existingMap.entries()) {
            if (entry.deletedAt) continue;
            try {
              const parsed = JSON.parse(entry.data);
              if (entry.entityType === 'courses') {
                if (!activeCourse || (parsed.updatedAt || 0) >= (activeCourse.updatedAt || 0)) {
                  activeCourse = parsed;
                }
              } else if (entry.entityType === 'subjects') {
                if (!activeSubject || (parsed.updatedAt || 0) >= (activeSubject.updatedAt || 0)) {
                  activeSubject = parsed;
                }
              } else if (entry.entityType === 'topics') {
                if (!activeTopic || (parsed.updatedAt || 0) >= (activeTopic.updatedAt || 0)) {
                  activeTopic = parsed;
                }
              }
            } catch (_) {}
          }

          const extStatements: any[] = [];

          if (!activeCourse) {
            activeCourse = {
              id: `course-ext-${now}`,
              name: 'Meus Estudos',
              color: '#6366f1',
              createdAt: now,
              updatedAt: now,
            };
            extStatements.push(
              env.DB.prepare(
                'INSERT OR REPLACE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL)'
              ).bind(userId, activeCourse.id, 'courses', JSON.stringify(activeCourse), now)
            );
          }

          if (!activeSubject) {
            activeSubject = {
              id: `subj-ext-${now + 1}`,
              courseId: activeCourse.id,
              name: 'Aulas & Gravações',
              color: '#6366f1',
              icon: 'BookOpen',
              createdAt: now + 1,
              updatedAt: now + 1,
            };
            extStatements.push(
              env.DB.prepare(
                'INSERT OR REPLACE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL)'
              ).bind(userId, activeSubject.id, 'subjects', JSON.stringify(activeSubject), now + 1)
            );
          }

          if (!activeTopic) {
            activeTopic = {
              id: `topic-ext-${now + 2}`,
              courseId: activeSubject.courseId || activeCourse.id,
              subjectId: activeSubject.id,
              title: 'Gravações da Extensão',
              date: new Date(now).toISOString().slice(0, 10),
              startTime: new Date(now).toLocaleTimeString('pt-BR'),
              studyDurationSeconds: 0,
              createdAt: now + 2,
              updatedAt: now + 2,
            };
            extStatements.push(
              env.DB.prepare(
                'INSERT OR REPLACE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL)'
              ).bind(userId, activeTopic.id, 'topics', JSON.stringify(activeTopic), now + 2)
            );
          }

          const isAudio = clientData.captureType === 'audio';
          const itemId =
            clientData.itemId ||
            `${isAudio ? 'rec' : 'print'}-${now}-${Math.random().toString(36).slice(2, 7)}`;
          const rawDataUrl: string = clientData.dataUrl;
          let storedMediaField = rawDataUrl;

          if (rawDataUrl.length > 20000) {
            await saveMediaChunks(env, userId, itemId, rawDataUrl, now);
            storedMediaField = EXTERNAL_MEDIA_MARKER;
          }

          const dateObj = new Date(now);
          const newItem: any = {
            id: itemId,
            topicId: activeTopic.id,
            subjectId: activeTopic.subjectId || activeSubject.id,
            courseId: activeTopic.courseId || activeSubject.courseId || activeCourse.id,
            type: isAudio ? 'audio' : 'photo',
            createdAt: now,
            updatedAt: now,
            timeLabel: dateObj.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            dateLabel: dateObj.toLocaleDateString('pt-BR'),
            orderIndex: now,
            title:
              clientData.pageTitle
                ? `${isAudio ? 'Áudio' : 'Print'}: ${String(clientData.pageTitle).slice(0, 50)}`
                : isAudio
                ? 'Gravação da Extensão'
                : 'Print da Extensão',
            content: '',
            transcript: clientData.transcript || undefined,
            importantForExam: false,
            mediaDataUrl: storedMediaField,
            audioDurationSeconds: isAudio ? Math.max(1, Number(clientData.duration) || 10) : undefined,
            audioWaveform: isAudio
              ? Array.from({ length: 28 }, () => Number((0.3 + Math.random() * 0.55).toFixed(2)))
              : undefined,
            syncStatus: 'synced',
          };

          extStatements.push(
            env.DB.prepare(
              'INSERT OR REPLACE INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, NULL)'
            ).bind(userId, itemId, 'items', JSON.stringify(newItem), now + 3)
          );

          for (const st of extStatements) {
            await st.run();
          }

          return jsonResponse({
            success: true,
            itemId,
            topicTitle: activeTopic.title,
            lastSyncedAt: now + 3,
          });
        }

        const clientDeletedIds: string[] = Array.isArray(clientData.deletedIds)
          ? clientData.deletedIds
          : [];
        const clientDeletedSet = new Set<string>(clientDeletedIds);
        const statements: any[] = [];

        // A. Aplicar exclusões: A EXCLUSÃO SEMPRE VENCE!
        for (const id of clientDeletedSet) {
          if (!id) continue;
          const current = existingMap.get(id);
          // Só grava no banco se ainda não estava marcado como excluído
          if (!current || !current.deletedAt) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO sync_entities (userId, entityId, entityType, data, updatedAt, deletedAt)
                 VALUES (?, ?, 'tombstone', '{}', ?, ?)
                 ON CONFLICT (userId, entityId)
                 DO UPDATE SET deletedAt = excluded.deletedAt, updatedAt = excluded.updatedAt`
              ).bind(userId, id, now, now)
            );
            statements.push(
              env.DB.prepare('DELETE FROM media_blobs WHERE userId = ? AND mediaId LIKE ?').bind(
                userId,
                `${id}#%`
              )
            );
          }
        }

        // Verificar se a conta na nuvem já possui dados reais do usuário
        const hasRealCloudData = existingMap.size > 0;
        const DEMO_IDS = new Set([
          'course-medicina',
          'course-exatas',
          'subj-fisiologia',
          'subj-calculo',
          'topic-neuro-01',
          'item-demo-1',
          'item-demo-2',
          'item-demo-3',
        ]);

        // B. Inserir ou atualizar entidades ativas
        const types = ['courses', 'subjects', 'topics', 'items', 'questions'] as const;
        for (const type of types) {
          const list = Array.isArray(clientData[type]) ? clientData[type] : [];
          for (const item of list) {
            if (!item || !item.id) continue;
            // Nunca ressuscita item deletado localmente ou no servidor
            if (clientDeletedSet.has(item.id)) continue;
            const current = existingMap.get(item.id);
            if (current && current.deletedAt) continue;

            // Se a conta já possui dados na nuvem e este item é um seed demo que não estava na nuvem, ignora para um dispositivo novo não poluir a conta
            if (hasRealCloudData && !current && DEMO_IDS.has(item.id)) {
              continue;
            }

            const itemCopy = { ...item };
            let rawMediaToSave: string | null = null;

            if (
              itemCopy.mediaDataUrl &&
              itemCopy.mediaDataUrl !== EXTERNAL_MEDIA_MARKER &&
              itemCopy.mediaDataUrl.length > 20000
            ) {
              rawMediaToSave = itemCopy.mediaDataUrl;
              itemCopy.mediaDataUrl = EXTERNAL_MEDIA_MARKER;
            }

            const serialized = JSON.stringify(itemCopy);

            // Se já existe idêntico no D1, não precisa reescrever nem alterar updatedAt!
            if (current && current.data === serialized) {
              continue;
            }

            // Se existir versão mais recente no D1 e o cliente enviou versão antiga (sem updatedAt maior), preserva a do D1
            const clientItemTime = Number(item.updatedAt || item.createdAt || 0);
            if (current && current.updatedAt > 0 && clientItemTime > 0 && clientItemTime < current.updatedAt) {
              continue;
            }

            if (rawMediaToSave) {
              await saveMediaChunks(env, userId, itemCopy.id, rawMediaToSave, now);
            }

            const newUpdatedAt = Math.max(now, clientItemTime);

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
              ).bind(userId, itemCopy.id, type, serialized, newUpdatedAt)
            );
          }
        }

        if (statements.length > 0) {
          for (let i = 0; i < statements.length; i += 25) {
            try {
              await env.DB.batch(statements.slice(i, i + 25));
            } catch (batchErr) {
              // Se algum lote falhar isoladamente, executa um por um para nunca perder o restante
              for (const stmt of statements.slice(i, i + 25)) {
                try {
                  await stmt.run();
                } catch (singleErr) {
                  console.warn('Falha ao gravar statement individual no D1:', singleErr);
                }
              }
            }
          }
        }
      }

      // 3. Montar e retornar o estado completo atualizado do D1
      const allRows = await env.DB.prepare(
        'SELECT entityType, entityId, data, updatedAt, deletedAt FROM sync_entities WHERE userId = ?'
      )
        .bind(userId)
        .all();

      const mediaMap = await loadAllMediaForUser(env, userId);

      const courses: any[] = [];
      const subjects: any[] = [];
      const topics: any[] = [];
      const items: any[] = [];
      const questions: any[] = [];
      const deletedIds: string[] = [];

      let maxUpdated = 0;

      for (const row of allRows.results || []) {
        const rowUpdated = Number(row.updatedAt) || 0;
        if (rowUpdated > maxUpdated) {
          maxUpdated = rowUpdated;
        }

        if (row.deletedAt) {
          deletedIds.push(row.entityId);
          continue;
        }

        try {
          const parsed = JSON.parse(row.data);
          if (parsed.mediaDataUrl === EXTERNAL_MEDIA_MARKER) {
            const restoredMedia =
              mediaMap.get(row.entityId) ||
              (env.NOTEON_KV
                ? await env.NOTEON_KV.get(`noteon:media:${userId}:${row.entityId}`, 'text')
                : null);
            if (restoredMedia) {
              parsed.mediaDataUrl = restoredMedia;
            } else {
              delete parsed.mediaDataUrl;
            }
          }

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
