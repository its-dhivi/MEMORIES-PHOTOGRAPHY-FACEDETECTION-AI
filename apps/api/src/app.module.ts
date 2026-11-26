import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessTokenGuard } from './auth/access-token.guard';
import { PlatformRolesGuard } from './auth/platform-roles.guard';
import { AuthModule } from './auth/auth.module';
import { CsrfMiddleware } from './common/csrf.middleware';
import { validateEnvironment } from './config/env';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { EventsModule } from './events/events.module';
import { PhotosModule } from './photos/photos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProcessingModule } from './processing/processing.module';
import { QrModule } from './qr/qr.module';
import { PublicModule } from './public/public.module';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueModule } from './infrastructure/queue.module';
import { StorageModule } from './infrastructure/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    AuthModule,
    HealthModule,
    QueueModule,
    StorageModule,
    AiModule,
    EventsModule,
    PhotosModule,
    DashboardModule,
    ProcessingModule,
    QrModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PlatformRolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
