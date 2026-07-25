/**
 * Central runtime configuration. Every value has a safe development default so
 * `npm run dev` works with an empty `.env`, while production overrides come
 * from environment variables only.
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  globalPrefix: string;
  corsOrigins: string[];
  publicWebUrl: string;
  database: {
    url: string;
    poolMax: number;
    ssl: boolean;
    statementTimeoutMs: number;
  };
  redis: { url: string; enabled: boolean };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
  };
  otp: { ttlSeconds: number; maxAttempts: number; length: number; devCode: string | null };
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    publicBaseUrl: string;
    presignExpirySeconds: number;
    maxUploadBytes: number;
  };
  sms: {
    provider: 'kavenegar' | 'farazsms' | 'console';
    apiKey: string;
    sender: string;
  };
  liveClass: {
    bbb: { baseUrl: string; secret: string };
    adobe: { baseUrl: string; apiKey: string; sessionTtlSeconds: number };
  };
  platform: { defaultCommissionPercent: number; currency: string };
  throttle: { ttlSeconds: number; limit: number };
}

export default (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
  port: int(process.env.PORT, 4000),
  globalPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:3000']),
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',

  database: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:1234@localhost:5432/institutes',
    poolMax: int(process.env.DATABASE_POOL_MAX, 10),
    ssl: bool(process.env.DATABASE_SSL, false),
    statementTimeoutMs: int(process.env.DATABASE_STATEMENT_TIMEOUT_MS, 15_000),
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    // Disabled by default in tests so the suite needs no infrastructure.
    enabled: bool(process.env.REDIS_ENABLED, process.env.NODE_ENV !== 'test'),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtlSeconds: int(process.env.JWT_ACCESS_TTL, 900), // 15 min
    refreshTtlSeconds: int(process.env.JWT_REFRESH_TTL, 60 * 60 * 24 * 30),
  },

  otp: {
    ttlSeconds: int(process.env.OTP_TTL_SECONDS, 120),
    maxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5),
    length: int(process.env.OTP_LENGTH, 5),
    // When set, the OTP flow always accepts this code (local development only).
    devCode: process.env.OTP_DEV_CODE ?? (process.env.NODE_ENV === 'production' ? null : '11111'),
  },

  storage: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'institutes',
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? 'http://localhost:9000/institutes',
    presignExpirySeconds: int(process.env.S3_PRESIGN_EXPIRY, 900),
    maxUploadBytes: int(process.env.S3_MAX_UPLOAD_BYTES, 2 * 1024 * 1024 * 1024),
  },

  sms: {
    provider: (process.env.SMS_PROVIDER as AppConfig['sms']['provider']) ?? 'console',
    apiKey: process.env.SMS_API_KEY ?? '',
    sender: process.env.SMS_SENDER ?? '10004346',
  },

  liveClass: {
    bbb: {
      baseUrl: process.env.BBB_BASE_URL ?? 'https://bbb.example.com/bigbluebutton/api',
      secret: process.env.BBB_SECRET ?? 'dev-bbb-secret',
    },
    adobe: {
      baseUrl: process.env.ADOBE_CONNECT_URL ?? 'https://connect.example.com/api/xml',
      apiKey: process.env.ADOBE_CONNECT_KEY ?? 'dev-adobe-key',
      sessionTtlSeconds: int(process.env.ADOBE_SESSION_TTL, 3600),
    },
  },

  platform: {
    defaultCommissionPercent: int(process.env.PLATFORM_COMMISSION_PERCENT, 10),
    currency: process.env.PLATFORM_CURRENCY ?? 'IRR',
  },

  throttle: {
    ttlSeconds: int(process.env.THROTTLE_TTL, 60),
    limit: int(process.env.THROTTLE_LIMIT, 120),
  },
});
