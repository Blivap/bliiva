import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JsonCacheService } from './json-cache.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RedisService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const service = new RedisService({
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string | undefined>('redis.password'),
          db: config.get<number>('redis.db', 0),
          keyPrefix: config.get<string>('redis.keyPrefix', 'bliiva:'),
        });
        return service;
      },
    },
    JsonCacheService,
  ],
  exports: [RedisService, JsonCacheService],
})
export class RedisModule {}
