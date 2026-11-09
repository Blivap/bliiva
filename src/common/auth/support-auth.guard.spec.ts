import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { IntentsAdminController } from '../../support/intelligence/intents.admin.controller.js';
import { IntentsService } from '../../support/intelligence/intents.service.js';
import { RuleBasedRecognizerService } from '../../support/intelligence/recognition/rule-based-recognizer.service.js';
import { AdminGuard } from './admin.guard.js';
import { SupportAuthGuard } from './support-auth.guard.js';

const USER_ID = '64b0000000000000000000aa';

function token(roles: string[]) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: USER_ID, roles })).toString(
    'base64url',
  );
  const signature = createHmac('sha256', 'jwt-secret')
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

describe('admin endpoint protection', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [IntentsAdminController],
      providers: [
        SupportAuthGuard,
        AdminGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'serviceAuth.apiKey') return 'test-key';
              if (key === 'nodeEnv') return 'test';
              if (key === 'serviceAuth.userJwtSecret') return 'jwt-secret';
              return fallback ?? '';
            },
          },
        },
        {
          provide: IntentsService,
          useValue: {
            list: async () => ({
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 1,
            }),
          },
        },
        {
          provide: RuleBasedRecognizerService,
          useValue: { recognize: async () => ({}) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a missing service key', async () => {
    await request(app.getHttpServer())
      .get('/support/admin/intents')
      .expect(401);
  });

  it('rejects a signed-in user who is not an administrator', async () => {
    await request(app.getHttpServer())
      .get('/support/admin/intents')
      .set('x-support-api-key', 'test-key')
      .set('authorization', `Bearer ${token(['user'])}`)
      .set('x-support-roles', 'administrator')
      .expect(403);
  });

  it('allows an administrator token and ignores a forged role header', async () => {
    await request(app.getHttpServer())
      .get('/support/admin/intents')
      .set('x-support-api-key', 'test-key')
      .set('authorization', `Bearer ${token(['administrator'])}`)
      .set('x-support-roles', 'user')
      .expect(200);
  });
});
