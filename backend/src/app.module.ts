import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { MinIOModule } from './minio/minio.module';
import { PresenceModule } from './presence/presence.module';
import { GamificationModule } from './gamification/gamification.module';
import { TimingModule } from './timing/timing.module';
import { RedListModule } from './redlist/redlist.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { DepartmentsModule } from './departments/departments.module';
import { NotesModule } from './notes/notes.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DocumentsModule } from './documents/documents.module';
import { OpinionsModule } from './opinions/opinions.module';
import { DesksModule } from './desks/desks.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { PerformanceModule } from './performance/performance.module';
import { BackFilesModule } from './backfiles/backfiles.module';
import { SecurityModule } from './security/security.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ChatModule } from './chat/chat.module';
import { DeskProfileModule } from './desk-profile/desk-profile.module';
import { CapacityModule } from './capacity/capacity.module';
import { TicketsModule } from './tickets/tickets.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    SecurityModule,
    RabbitMQModule,
    MinIOModule,
    PresenceModule,
    GamificationModule,
    TimingModule,
    RedListModule,
    AuthModule,
    FilesModule,
    DepartmentsModule,
    NotesModule,
    UsersModule,
    HealthModule,
    NotificationsModule,
    AdminModule,
    AnalyticsModule,
    DocumentsModule,
    OpinionsModule,
    DesksModule,
    DispatchModule,
    PerformanceModule,
    BackFilesModule,
    WorkflowModule,
    ChatModule,
    DeskProfileModule,
    CapacityModule,
    TicketsModule,
    AssistantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
