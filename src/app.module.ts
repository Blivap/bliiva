import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor.js';
import {
  configuration,
  databaseConfig,
  envValidationSchema,
  redisConfig,
} from './config/index.js';
import { HealthModule } from './health/health.module.js';
import { BlivapIntegrationModule } from './integrations/blivap/index.js';
import { resolveRedisConnection } from './redis/redis-connection.js';
import { RedisModule } from './redis/redis.module.js';
import { SupportModule } from './support/support.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration, databaseConfig, redisConfig],
      validationSchema: envValidationSchema,
    }),

    ObserveModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        appKey: config.get<string>('observe.appKey', 'YOUR_APP_KEY'),
        appSecret: config.get<string>('observe.appSecret', 'YOUR_APP_SECRET'),
        serviceId: 'bliiva',
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('database.uri'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttlMs', 60000),
          limit: config.get<number>('throttle.limit', 60),
        },
      ],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connection = resolveRedisConnection({
          url: config.get<string | undefined>('redis.url'),
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string | undefined>('redis.password'),
          db: config.get<number>('redis.db', 0),
        });
        return {
          prefix: config.get<string>('bullmq.prefix', '{bliiva}'),
          connection: {
            ...connection,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    RedisModule,
    BlivapIntegrationModule,
    SupportModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
