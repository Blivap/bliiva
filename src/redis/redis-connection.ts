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
  // Live URLs (Render Key Value and other managed Redis) only have database 0.
  // A path like /1 or REDIS_DB=1 makes that server return
  // "ERR DB index is out of range". Key prefixes keep Bliiva keys separate.
  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || '6379', 10),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
