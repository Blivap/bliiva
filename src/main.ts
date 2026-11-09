import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('apiPrefix', 'api/v1');
  const port = config.get<number>('port', 3000);
  const swaggerEnabled = config.get<boolean>('swagger.enabled', true);
  const swaggerPath = config.get<string>('swagger.path', 'docs');

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();
  app.enableShutdownHooks();

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Bliiva Support API')
      .setDescription(
        'Self-hosted Blivap intelligent customer support platform. Deterministic rules engine plus optional local Ollama/RAG agent; Blivap domain actions via an allowlisted integration port.',
      )
      .setVersion('0.1.0')
      .addApiKey(
        { type: 'apiKey', name: 'x-support-api-key', in: 'header' },
        'support-service',
      )
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'user-jwt',
      )
      .addTag('health')
      .addTag('support')
      .addTag('support-admin')
      .build();

    const documentFactory = () =>
      SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, documentFactory, {
      useGlobalPrefix: false,
    });
  }

  await app.listen(port);
  Logger.log(
    `Bliiva Support API listening on http://localhost:${port}/${apiPrefix}`,
    'Bootstrap',
  );
  if (swaggerEnabled) {
    Logger.log(
      `Swagger docs at http://localhost:${port}/${swaggerPath}`,
      'Bootstrap',
    );
  }
}

await bootstrap();
