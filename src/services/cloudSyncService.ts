import { Course, Subject, StudyTopic, TimelineItem, StudyQuestion } from '../types';

const CLOUD_TOKEN_KEY = 'noteon_cloud_jwt_v1';
const CLOUD_USER_KEY = 'noteon_cloud_user_v1';

export interface CloudUser {
  userId: string;
  email: string;
}

export function getCloudUser(): CloudUser | null {
  try {
    const raw = localStorage.getItem(CLOUD_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getCloudToken(): string | null {
  try {
    return localStorage.getItem(CLOUD_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function isCloudLoggedIn(): boolean {
  return Boolean(getCloudToken() && getCloudUser());
}

export function saveCloudSession(user: CloudUser, token: string): void {
  try {
    localStorage.setItem(CLOUD_USER_KEY, JSON.stringify(user));
    localStorage.setItem(CLOUD_TOKEN_KEY, token);
  } catch (err) {
    console.warn('Erro ao salvar sessão no localStorage:', err);
  }
}

export function clearCloudSession(): void {
  try {
    localStorage.removeItem(CLOUD_USER_KEY);
    localStorage.removeItem(CLOUD_TOKEN_KEY);
  } catch (err) {
    console.warn('Erro ao limpar sessão no localStorage:', err);
  }
}

async function parseResponseJson(res: Response, fallbackMsg: string) {
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      res.status === 404
        ? 'Serviço de nuvem temporariamente indisponível. Aguarde alguns segundos e tente novamente.'
        : `Erro de comunicação com o servidor (${res.status}): ${text.slice(0, 100)}`
    );
  }
  if (!res.ok) {
    throw new Error(json?.error || json?.message || fallbackMsg);
  }
  return json;
}

export async function cloudRegister(email: string, password: string): Promise<CloudUser> {
  const res = await fetch('/api/auth?action=register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', email, password }),
  });

  const data = await parseResponseJson(res, 'Falha ao criar conta.');
  saveCloudSession(data.user, data.token);
  return data.user;
}

export async function cloudLogin(email: string, password: string): Promise<CloudUser> {
  const res = await fetch('/api/auth?action=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password }),
  });

  const data = await parseResponseJson(res, 'Falha no login.');
  saveCloudSession(data.user, data.token);
  return data.user;
}

export function cloudLogout(): void {
  clearCloudSession();
}

export interface SyncPayload {
  courses: Course[];
  subjects: Subject[];
  topics: StudyTopic[];
  items: TimelineItem[];
  questions: StudyQuestion[];
}

export async function syncWithCloud(localData: SyncPayload): Promise<{
  success: boolean;
  data: SyncPayload & { lastSyncedAt?: number };
}> {
  const token = getCloudToken();
  if (!token) {
    throw new Error('Usuário não está conectado na nuvem.');
  }

  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(localData),
  });

  return await parseResponseJson(res, 'Falha na sincronização.');
}

