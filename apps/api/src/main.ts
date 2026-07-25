import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exceptions/http-exception.filter';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  const prefix = config.get('globalPrefix', { infer: true });
  app.setGlobalPrefix(prefix);

  app.use(
    helmet({
      // Swagger UI needs inline styles/scripts.
      contentSecurityPolicy: config.get('nodeEnv', { infer: true }) === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties so clients cannot inject extra columns.
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Trust the reverse proxy so client IPs in contracts are accurate.
  app.getHttpAdapter().getInstance().set?.('trust proxy', 1);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Institutes Platform API')
    .setDescription(
      'Map-first educational marketplace: discovery, pre-registration, CRM, LMS and payouts.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('discovery', 'Map pins, filters and institute storefronts')
    .addTag('auth', 'OTP and password authentication')
    .addTag('forms & leads', 'Dynamic pre-registration and the CRM Kanban')
    .addTag('quizzes', 'Quiz engine with offline sync and anti-cheat')
    .addTag('live classes', 'Adobe Connect and BigBlueButton SSO')
    .addTag('finance', 'Wallet, commission and payouts')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');

  logger.log(`API listening on http://localhost:${port}/${prefix}`);
  logger.log(`Swagger UI at    http://localhost:${port}/${prefix}/docs`);
}

bootstrap().catch((error: Error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start the API:', error);
  process.exit(1);
});
