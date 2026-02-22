import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsVisualizationService } from './analytics-visualization.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DesksModule } from '../desks/desks.module';
import { RedListModule } from '../redlist/redlist.module';

@Module({
  imports: [PrismaModule, DesksModule, RedListModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsVisualizationService],
  exports: [AnalyticsService, AnalyticsVisualizationService],
})
export class AnalyticsModule {}
