import { Module } from '@nestjs/common';
import { RedListService } from './redlist.service';
import { FileRedListService } from './file-redlist.service';
import { FileRedListController } from './file-redlist.controller';
import { GamificationModule } from '../gamification/gamification.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [GamificationModule, RabbitMQModule, PrismaModule, NotificationsModule],
  controllers: [FileRedListController],
  providers: [RedListService, FileRedListService],
  exports: [RedListService, FileRedListService],
})
export class RedListModule {}
