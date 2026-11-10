import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis as IoRedis } from 'ioredis';
import { resolveRedisConnection } from './redis-connection.js';

export interface RedisConnectionOptions {
  url?: string;
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: IoRedis;

  constructor(options: RedisConnectionOptions) {
    const connection = resolveRedisConnection(options);
    this.client = new IoRedis({
      ...connection,
      keyPrefix: options.keyPrefix,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  getClient(): IoRedis {
    return this.client;
  }

  async connect(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async ping(): Promise<string> {
    await this.connect();
    return this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.connect();
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(
        `Redis get failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    try {
      await this.connect();
      if (ttlMs && ttlMs > 0) {
        await this.client.set(key, value, 'PX', ttlMs);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.warn(
        `Redis set failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.connect();
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis delete failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
