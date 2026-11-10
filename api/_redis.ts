// Helper to communicate with Upstash Redis / Vercel KV REST API without external dependencies

export function getRedisConfig() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    '';
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    '';

  return {
    url: url.replace(/\/$/, ''),
    token,
    isConfigured: Boolean(url && token),
  };
}

export async function redisCommand(command: string[]): Promise<any> {
  const { url, token, isConfigured } = getRedisConfig();

  if (!isConfigured) {
    throw new Error(
      'REDIS_NOT_CONFIGURED: Conecte o Vercel KV ou Upstash no painel da Vercel (Storage -> KV).'
    );
  }

  const response = await fetch(`${url}`, {
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

  const data = await response.json();
  return data.result;
}

export async function redisGet<T = any>(key: string): Promise<T | null> {
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

export async function redisSet(
  key: string,
  value: any,
  exSeconds?: number
): Promise<string> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const cmd = ['SET', key, serialized];
  if (exSeconds) {
    cmd.push('EX', exSeconds.toString());
  }
  return await redisCommand(cmd);
}

export async function redisDel(key: string): Promise<number> {
  return await redisCommand(['DEL', key]);
}
