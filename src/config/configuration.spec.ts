import configuration from './configuration.js';

describe('configuration', () => {
  it('returns redis isolation defaults for Blivap coexistence', () => {
    const config = configuration();
    expect(config.redis.keyPrefix).toBe('bliiva:');
    expect(config.bullmq.prefix).toBe('{bliiva}');
  });
});
