import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import type { Response } from 'express';
import { okResponse } from '../common/interfaces/api-response.interface.js';
import { RedisService } from '../redis/redis.service.js';

/** Avoid importing mongoose.Connection — it is not an ESM named export. */
interface MongoConnectionStatus {
  readyState: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: MongoConnectionStatus,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness and dependency checks',
    description:
      'Returns 200 when MongoDB and Redis are reachable, and 503 when either dependency is down.',
  })
  async check(@Res({ passthrough: true }) response: Response) {
    const mongoOk = this.mongo.readyState === 1;
    let redisOk = false;
    let redisError: string | undefined;

    try {
      redisOk = (await this.redis.ping()) === 'PONG';
    } catch (error) {
      redisError = error instanceof Error ? error.message : 'unknown';
    }

    const healthy = mongoOk && redisOk;
    response.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return okResponse(
      healthy ? 'Support API healthy' : 'Support API degraded',
      {
        status: healthy ? 'ok' : 'degraded',
        mongo: mongoOk ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
        ...(redisError ? { redisError } : {}),
      },
    );
  }
}
