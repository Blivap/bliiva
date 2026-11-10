import { describe, expect, it } from 'vitest';
import { resolveRedisConnection } from './redis-connection.js';

describe('resolveRedisConnection', () => {
  it('uses discrete host settings when REDIS_URL is absent', () => {
    expect(
      resolveRedisConnection({
        host: 'localhost',
        port: 6379,
        password: 'secret',
        db: 1,
      }),
    ).toEqual({
      host: 'localhost',
      port: 6379,
      password: 'secret',
      db: 1,
    });
  });

  it('parses redis:// and rediss:// connection strings', () => {
    expect(
      resolveRedisConnection({
        url: 'redis://:pass%40word@cache.example:6380/2',
        host: 'localhost',
        port: 6379,
        db: 0,
      }),
    ).toEqual({
      host: 'cache.example',
      port: 6380,
      username: undefined,
      password: 'pass@word',
      db: 2,
      tls: undefined,
    });

    expect(
      resolveRedisConnection({
        url: 'rediss://default:token@upstash.example:6379/0',
        host: 'localhost',
        port: 6379,
        db: 1,
      }),
    ).toMatchObject({
      host: 'upstash.example',
      port: 6379,
      username: 'default',
      password: 'token',
      db: 0,
      tls: {},
    });
  });
});
