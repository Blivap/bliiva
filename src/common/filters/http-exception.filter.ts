import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let details: unknown;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const payload = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };
      message = Array.isArray(payload.message)
        ? payload.message.join(', ')
        : (payload.message ?? payload.error ?? message);
      details = exceptionResponse;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload = {
      event: 'http.exception',
      method: request.method,
      path: request.originalUrl || request.url,
      statusCode: status,
      message,
      aiActive: process.env.LLM_ENABLED === 'true',
    };

    if (status >= 500) {
      this.logger.error(
        JSON.stringify(payload),
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(JSON.stringify(payload));
    }

    response.status(status).json({
      success: false,
      message,
      ...(process.env.NODE_ENV !== 'production' && details ? { details } : {}),
    });
  }
}
