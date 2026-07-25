import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { DatabaseModule } from './db/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { FinanceModule } from './modules/finance/finance.module';
import { FormsModule } from './modules/forms/forms.module';
import { HealthModule } from './modules/health/health.module';
import { InstitutesModule } from './modules/institutes/institutes.module';
import { LiveClassesModule } from './modules/live-classes/live-classes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QueueModule } from './modules/queue/queue.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { StorageModule } from './modules/storage/storage.module';

/**
 * Modular monolith root.
 *
 * Each feature module is self-contained and communicates through services, so
 * any of them can later be extracted into its own microservice without
 * touching call sites.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const config = configuration();
        return [
          {
            name: 'default',
            ttl: config.throttle.ttlSeconds * 1000,
            limit: config.throttle.limit,
          },
        ];
      },
    }),
    ScheduleModule.forRoot(),

    DatabaseModule,
    QueueModule,
    RealtimeModule,

    AuthModule,
    NotificationsModule,
    InstitutesModule,
    DiscoveryModule,
    CoursesModule,
    FormsModule,
    EnrollmentsModule,
    QuizzesModule,
    LiveClassesModule,
    StorageModule,
    FinanceModule,
    HealthModule,
  ],
  providers: [
    // Global auth: every route requires a bearer token unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
