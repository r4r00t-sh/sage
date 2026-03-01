import { Module } from '@nestjs/common';
import { DesksService } from './desks.service';
import { DesksController } from './desks.controller';
import { DeskPerformanceService } from './desk-performance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RedListModule } from '../redlist/redlist.module';
import { TimingModule } from '../timing/timing.module';

@Module({
  imports: [PrismaModule, NotificationsModule, RedListModule, TimingModule],
  controllers: [DesksController],
  providers: [DesksService, DeskPerformanceService],
  exports: [DesksService, DeskPerformanceService],
})
export class DesksModule {}
