import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Observable, catchError, throwError, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpTraffic');

  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = Date.now();
    const aiActive = this.config.get<boolean>('llm.enabled', false);
    const aiModel = this.config.get<string>('llm.model', 'unknown');
    const path = request.originalUrl || request.url;
    const method = request.method;
    const requestId =
      headerValue(request.headers['x-request-id']) ||
      `req_${started.toString(36)}`;

    this.logger.log(
      JSON.stringify({
        event: 'http.request.in',
        requestId,
        method,
        path,
        ip: request.ip,
        userAgent: headerValue(request.headers['user-agent']) || null,
        contentLength: headerValue(request.headers['content-length']) || null,
        hasAuth: Boolean(
          headerValue(request.headers.authorization) ||
            headerValue(request.headers['x-support-api-key']),
        ),
        aiActive,
        aiModel: aiActive ? aiModel : null,
      }),
    );

    return next.handle().pipe(
      tap({
        next: (body) => {
          this.logger.log(
            JSON.stringify({
              event: 'http.request.out',
              requestId,
              method,
              path,
              statusCode: response.statusCode,
              durationMs: Date.now() - started,
              aiActive,
              summary: summarizeBody(body),
            }),
          );
        },
        error: (error: unknown) => {
          this.logger.error(
            JSON.stringify({
              event: 'http.request.error',
              requestId,
              method,
              path,
              statusCode: response.statusCode || 500,
              durationMs: Date.now() - started,
              aiActive,
              message: error instanceof Error ? error.message : 'unknown',
            }),
          );
        },
      }),
      catchError((error: unknown) => throwError(() => error)),
    );
  }
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function summarizeBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const data =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : null;
  return {
    success: typeof record.success === 'boolean' ? record.success : undefined,
    message:
      typeof record.message === 'string'
        ? record.message.slice(0, 160)
        : undefined,
    responseType:
      typeof data?.responseType === 'string' ? data.responseType : undefined,
    conversationId:
      typeof data?.conversationId === 'string'
        ? data.conversationId
        : undefined,
  };
}
