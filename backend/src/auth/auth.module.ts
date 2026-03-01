import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RbacService } from './rbac.service';
import { GamificationModule } from '../gamification/gamification.module';
import { PresenceModule } from '../presence/presence.module';
import { JwtModuleOptions } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>(
          'JWT_SECRET',
          'your-super-secret-jwt-key-change-in-production',
        ),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
    }),
    GamificationModule,
    PresenceModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RbacService],
  exports: [AuthService, RbacService, JwtModule],
})
export class AuthModule {}
