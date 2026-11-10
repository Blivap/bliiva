import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  /** Prefer a full URL in production (redis:// or rediss://). */
  url: process.env.REDIS_URL?.trim() || undefined,
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'bliiva:',
}));
