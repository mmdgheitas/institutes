import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Normalizes every error into the `ApiErrorBody` contract the clients expect,
 * and maps well-known Postgres error codes onto sensible HTTP statuses so a
 * constraint violation never leaks as a 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error } = this.resolve(exception);

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: (request.headers['x-request-id'] as string) || undefined,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status}`);
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { status, message: payload, error: exception.name };
      }
      const record = payload as Record<string, unknown>;
      return {
        status,
        message: (record.message as string | string[]) ?? exception.message,
        error: (record.error as string) ?? exception.name,
      };
    }

    // Postgres driver errors.
    const pgCode = (exception as { code?: string })?.code;
    switch (pgCode) {
      case '23505': // unique_violation
        return {
          status: HttpStatus.CONFLICT,
          message: 'A record with these values already exists',
          error: 'Conflict',
        };
      case '23503': // foreign_key_violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Referenced record does not exist',
          error: 'Bad Request',
        };
      case '23514': // check_violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'A value violates a database constraint',
          error: 'Bad Request',
        };
      case '22P02': // invalid_text_representation (bad uuid)
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Malformed identifier',
          error: 'Bad Request',
        };
      case '57014': // query_canceled (statement timeout)
        return {
          status: HttpStatus.GATEWAY_TIMEOUT,
          message: 'The query took too long and was cancelled',
          error: 'Gateway Timeout',
        };
      default:
        break;
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : ((exception as Error)?.message ?? 'Internal server error'),
      error: 'Internal Server Error',
    };
  }
}
