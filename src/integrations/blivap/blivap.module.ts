import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BLIVAP_INTEGRATION } from './blivap.tokens.js';
import { HttpBlivapClient } from './http-blivap.client.js';
import { NoopBlivapClient } from './noop-blivap.client.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    NoopBlivapClient,
    HttpBlivapClient,
    {
      provide: BLIVAP_INTEGRATION,
      inject: [ConfigService, HttpBlivapClient, NoopBlivapClient],
      useFactory: (
        config: ConfigService,
        http: HttpBlivapClient,
        noop: NoopBlivapClient,
      ) => {
        const mode = config.get<string>('blivap.client', 'http');
        return mode === 'noop' ? noop : http;
      },
    },
  ],
  exports: [BLIVAP_INTEGRATION, HttpBlivapClient, NoopBlivapClient],
})
export class BlivapIntegrationModule {}
