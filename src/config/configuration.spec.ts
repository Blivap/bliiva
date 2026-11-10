import configuration from './configuration.js';

describe('configuration', () => {
  const originalUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalUrl;
  });

  it('returns redis isolation defaults for Blivap coexistence', () => {
    delete process.env.REDIS_URL;
    const config = configuration();
    expect(config.redis.keyPrefix).toBe('bliiva:');
    expect(config.redis.url).toBeUndefined();
    expect(config.bullmq.prefix).toBe('{bliiva}');
  });

  it('reads REDIS_URL for production connection strings', () => {
    process.env.REDIS_URL = 'rediss://default:secret@redis.example:6379/1';
    const config = configuration();
    expect(config.redis.url).toBe(
      'rediss://default:secret@redis.example:6379/1',
    );
  });
});
