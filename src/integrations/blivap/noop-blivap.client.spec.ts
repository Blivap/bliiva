import { ServiceUnavailableException } from '@nestjs/common';
import { NoopBlivapClient } from './noop-blivap.client.js';

describe('NoopBlivapClient', () => {
  it('fails closed until an HTTP Blivap adapter is selected', async () => {
    const client = new NoopBlivapClient();
    await expect(
      client.getProfile({
        userId: '64b0000000000000000000aa',
        accessToken: 'token',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
