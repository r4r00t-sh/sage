import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from './security.service';
import { FileUploadGuard } from './file-upload.guard';
import { SanitizeInterceptor } from './sanitize.interceptor';
import { SsrfService } from './ssrf.service';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 1 minute
            // SPA + polling can burst; raise default (override with RATE_LIMIT_DEFAULT)
            limit: config.get<number>('RATE_LIMIT_DEFAULT', 800),
          },
        ],
      }),
    }),
  ],
  providers: [
    SecurityService,
    SsrfService,
    FileUploadGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeInterceptor,
    },
  ],
  exports: [SecurityService, SsrfService, FileUploadGuard],
})
export class SecurityModule {}
