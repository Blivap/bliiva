export interface RedisDiscreteOptions {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db: number;
  tls?: Record<string, never>;
}

/**
 * Build ioredis/BullMQ connection options from REDIS_URL or discrete host vars.
 * Prefer REDIS_URL in production (redis:// or rediss://).
 */
export function resolveRedisConnection(input: {
  url?: string;
  host: string;
  port: number;
  password?: string;
  db: number;
}): RedisDiscreteOptions {
  if (!input.url) {
    return {
      host: input.host,
      port: input.port,
      password: input.password,
      db: input.db,
    };
  }

  const parsed = new URL(input.url);
  const dbPath = parsed.pathname.replace(/^\//, '');
  const db = dbPath ? Number.parseInt(dbPath, 10) : input.db;
  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || '6379', 10),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : input.db,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
