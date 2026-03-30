import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeskPerformanceService } from '../desks/desk-performance.service';
import { FileRedListService } from '../redlist/file-redlist.service';

@Injectable()
export class AnalyticsVisualizationService {
  constructor(
    private prisma: PrismaService,
    private deskPerformance: DeskPerformanceService,
    private fileRedList: FileRedListService,
  ) {}

  /**
   * Executive Dashboard - Ticker, Leaderboard, Watchlist
   */
  async getExecutiveDashboard(departmentId?: string) {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    const whereBase: any = {};
    if (departmentId) whereBase.departmentId = departmentId;

    // Global Backlog Count
    const globalBacklog = await this.prisma.file.count({
      where: {
        ...whereBase,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // Average Processing Speed (across all desks)
    const allDesks = await this.prisma.desk.findMany({
      where: { ...whereBase, isActive: true },
      select: { id: true },
    });

    const avgProcessingSpeeds = await Promise.all(
      allDesks.map((d) => this.deskPerformance.calculateAverageHandlingTime(d.id, todayStart, todayEnd)),
    );
    const avgProcessingSpeed = avgProcessingSpeeds.length > 0
      ? avgProcessingSpeeds.reduce((a, b) => a + b, 0) / avgProcessingSpeeds.length
      : 0;

    // Total Throughput Today
    const totalThroughput = await this.prisma.fileMovement.count({
      where: {
        desk: departmentId ? { departmentId } : undefined,
        endTS: { gte: todayStart, lte: todayEnd },
        status: 'COMPLETED',
      },
    });

    // Leaderboard: Top 5 Desks by Velocity Score
    const deskScores = await Promise.all(
      allDesks.map(async (d) => {
        const score = await this.deskPerformance.calculateDeskScore(d.id, todayStart, todayEnd);
        const desk = await this.prisma.desk.findUnique({
          where: { id: d.id },
          include: { department: { select: { name: true } } },
        });
        return {
          deskId: d.id,
          deskName: desk?.name,
          deskCode: desk?.code,
          department: desk?.department.name,
          velocityScore: score.velocityScore,
          overallScore: score.score,
          category: score.category,
        };
      }),
    );

    const leaderboard = deskScores
      .sort((a, b) => b.velocityScore - a.velocityScore)
      .slice(0, 5);

    // Watchlist: All Red-Listed desks
    const redListedDesks = await Promise.all(
      allDesks.map(async (d) => {
        const redListCheck = await this.deskPerformance.checkDeskRedListTriggers(d.id);
        if (redListCheck.shouldRedList) {
          const desk = await this.prisma.desk.findUnique({
            where: { id: d.id },
            include: { department: { select: { name: true } } },
          });
          return {
            deskId: d.id,
            deskName: desk?.name,
            deskCode: desk?.code,
            department: desk?.department.name,
            reason: redListCheck.reason,
          };
        }
        return null;
      }),
    );

    const watchlist = redListedDesks.filter((d) => d !== null);

    return {
      ticker: {
        globalBacklogCount: globalBacklog,
        avgProcessingSpeedHours: Math.round(avgProcessingSpeed * 100) / 100,
        totalThroughputToday: totalThroughput,
      },
      leaderboard,
      watchlist,
    };
  }

  /**
   * Heatmap (Bottleneck Detection)
   * X-Axis: Time (Hours of day or Days of week)
   * Y-Axis: Desk Names
   * Cell Color: Based on Flow Balance Ratio
   * - Green: Balanced (FBR >= 0.9)
   * - Yellow: Slight Accumulation (0.7 <= FBR < 0.9)
   * - Red: Severe Bottleneck (FBR < 0.7)
   */
  async getBottleneckHeatmap(
    departmentId?: string,
    timeRange: 'daily' | 'weekly' = 'daily',
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const whereBase: any = { isActive: true };
    if (departmentId) whereBase.departmentId = departmentId;

    const desks = await this.prisma.desk.findMany({
      where: whereBase,
      select: { id: true, name: true, code: true },
    });

    const heatmapData: Array<{
      deskId: string;
      deskName: string;
      deskCode: string;
      timeSlots: Array<{
        time: string;
        fbr: number;
        color: 'green' | 'yellow' | 'red';
        inflow: number;
        outflow: number;
      }>;
    }> = [];

    for (const desk of desks) {
      const timeSlots: Array<{
        time: string;
        fbr: number;
        color: 'green' | 'yellow' | 'red';
        inflow: number;
        outflow: number;
      }> = [];

      if (timeRange === 'daily') {
        // Hourly breakdown for last 24 hours
        for (let hour = 0; hour < 24; hour++) {
          const slotStart = new Date(start);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setHours(hour + 1, 0, 0, 0);

          const fbr = await this.deskPerformance.calculateFlowBalanceRatio(
            desk.id,
            slotStart,
            slotEnd,
          );

          const inflow = await this.prisma.fileMovement.count({
            where: {
              deskId: desk.id,
              arrivalTS: { gte: slotStart, lt: slotEnd },
            },
          });

          const outflow = await this.prisma.fileMovement.count({
            where: {
              deskId: desk.id,
              endTS: { gte: slotStart, lt: slotEnd },
              status: 'COMPLETED',
            },
          });

          let color: 'green' | 'yellow' | 'red' = 'green';
          if (fbr < 0.7) color = 'red';
          else if (fbr < 0.9) color = 'yellow';

          timeSlots.push({
            time: `${hour}:00`,
            fbr: Math.round(fbr * 100) / 100,
            color,
            inflow,
            outflow,
          });
        }
      } else {
        // Daily breakdown for last 7 days
        for (let day = 0; day < 7; day++) {
          const slotStart = new Date(start);
          slotStart.setDate(slotStart.getDate() + day);
          slotStart.setHours(0, 0, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setDate(slotEnd.getDate() + 1);

          const fbr = await this.deskPerformance.calculateFlowBalanceRatio(
            desk.id,
            slotStart,
            slotEnd,
          );

          const inflow = await this.prisma.fileMovement.count({
            where: {
              deskId: desk.id,
              arrivalTS: { gte: slotStart, lt: slotEnd },
            },
          });

          const outflow = await this.prisma.fileMovement.count({
            where: {
              deskId: desk.id,
              endTS: { gte: slotStart, lt: slotEnd },
              status: 'COMPLETED',
            },
          });

          let color: 'green' | 'yellow' | 'red' = 'green';
          if (fbr < 0.7) color = 'red';
          else if (fbr < 0.9) color = 'yellow';

          timeSlots.push({
            time: slotStart.toISOString().split('T')[0],
            fbr: Math.round(fbr * 100) / 100,
            color,
            inflow,
            outflow,
          });
        }
      }

      heatmapData.push({
        deskId: desk.id,
        deskName: desk.name,
        deskCode: desk.code,
        timeSlots,
      });
    }

    return {
      timeRange,
      period: { from: start, to: now },
      heatmapData,
    };
  }

  /**
   * Aging Bucket Report
   * Stacked bar chart showing pending files by age:
   * - 0-24 Hours (Fresh)
   * - 24-48 Hours (Standard)
   * - 48-72 Hours (Delayed)
   * - 72+ Hours (Critical)
   */
  async getAgingBucketReport(departmentId?: string) {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const whereBase: any = {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    };
    if (departmentId) whereBase.departmentId = departmentId;

    // Get all pending files with their arrival times
    const files = await this.prisma.file.findMany({
      where: whereBase,
      include: {
        desk: { select: { id: true, name: true } },
        fileMovements: {
          where: { status: { in: ['PENDING', 'IN_PROCESS'] } },
          orderBy: { arrivalTS: 'desc' },
          take: 1,
        },
      },
    });

    const buckets = {
      fresh: { count: 0, files: [] as any[] }, // 0-24 Hours
      standard: { count: 0, files: [] as any[] }, // 24-48 Hours
      delayed: { count: 0, files: [] as any[] }, // 48-72 Hours
      critical: { count: 0, files: [] as any[] }, // 72+ Hours
    };

    for (const file of files) {
      const movement = file.fileMovements[0];
      if (!movement) continue;

      const age = (now.getTime() - movement.arrivalTS.getTime()) / (1000 * 60 * 60); // in hours

      const fileInfo = {
        fileId: file.id,
        fileNumber: file.fileNumber,
        subject: file.subject,
        desk: file.desk ? { id: file.desk.id, name: file.desk.name } : null,
        ageHours: Math.round(age * 100) / 100,
      };

      if (age <= 24) {
        buckets.fresh.count++;
        buckets.fresh.files.push(fileInfo);
      } else if (age <= 48) {
        buckets.standard.count++;
        buckets.standard.files.push(fileInfo);
      } else if (age <= 72) {
        buckets.delayed.count++;
        buckets.delayed.files.push(fileInfo);
      } else {
        buckets.critical.count++;
        buckets.critical.files.push(fileInfo);
      }
    }

    // Sort files by age (oldest first) in each bucket
    buckets.fresh.files.sort((a, b) => b.ageHours - a.ageHours);
    buckets.standard.files.sort((a, b) => b.ageHours - a.ageHours);
    buckets.delayed.files.sort((a, b) => b.ageHours - a.ageHours);
    buckets.critical.files.sort((a, b) => b.ageHours - a.ageHours);

    return {
      totalPending: files.length,
      buckets: {
        fresh: {
          label: '0-24 Hours (Fresh)',
          count: buckets.fresh.count,
          files: buckets.fresh.files.slice(0, 20), // Limit to top 20
        },
        standard: {
          label: '24-48 Hours (Standard)',
          count: buckets.standard.count,
          files: buckets.standard.files.slice(0, 20),
        },
        delayed: {
          label: '48-72 Hours (Delayed)',
          count: buckets.delayed.count,
          files: buckets.delayed.files.slice(0, 20),
        },
        critical: {
          label: '72+ Hours (Critical)',
          count: buckets.critical.count,
          files: buckets.critical.files.slice(0, 20),
        },
      },
    };
  }

  /**
   * Get Red-List Morgue (Escalation Pit) visualization
   */
  async getRedListMorgueVisualization(departmentId?: string, departmentIds?: string[]) {
    const morgue = await this.fileRedList.getRedListMorgue(departmentId, departmentIds);

    // Group by escalation level
    const byEscalationLevel = {
      level1: morgue.filter((f) => (f.escalationLevel || 0) === 1),
      level2: morgue.filter((f) => (f.escalationLevel || 0) === 2),
      level3: morgue.filter((f) => (f.escalationLevel || 0) === 3),
    };

    // Group by reason
    const byReason = morgue.reduce((acc, file) => {
      const reason = file.reason || 'UNKNOWN';
      if (!acc[reason]) acc[reason] = [];
      acc[reason].push(file);
      return acc;
    }, {} as Record<string, typeof morgue>);

    return {
      total: morgue.length,
      byEscalationLevel: {
        level1: { count: byEscalationLevel.level1.length, files: byEscalationLevel.level1 },
        level2: { count: byEscalationLevel.level2.length, files: byEscalationLevel.level2 },
        level3: { count: byEscalationLevel.level3.length, files: byEscalationLevel.level3 },
      },
      byReason: Object.entries(byReason).map(([reason, files]) => ({
        reason,
        count: files.length,
        files: files.slice(0, 10), // Top 10 per reason
      })),
      allFiles: morgue,
    };
  }
}

