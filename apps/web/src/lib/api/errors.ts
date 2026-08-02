import type { ApiErrorBody } from '@shared/dto';

/** Typed error thrown by the API client for every non-2xx response. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly body: ApiErrorBody | null;
  readonly requestId?: string;

  constructor(statusCode: number, body: ApiErrorBody | null) {
    const message = Array.isArray(body?.message)
      ? body!.message.join('، ')
      : body?.message ?? `خطای ناشناخته (${statusCode})`;
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.body = body;
    this.requestId = body?.requestId;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isConflict(): boolean {
    return this.statusCode === 409;
  }

  get isValidation(): boolean {
    return this.statusCode === 400;
  }
}

/** Network-level failure (offline, DNS, proxy). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}
