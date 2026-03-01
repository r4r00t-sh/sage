import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FileRedListService } from '../redlist/file-redlist.service';

@Injectable()
export class DeskPerformanceService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private fileRedListService: FileRedListService,
  ) {}

  /**
   * Calculate Flow Balance Ratio (FBR) - Critical metric for identifying bottlenecks
   * FBR = Outflow Volume / Inflow Volume
   * - FBR = 1.0: Perfectly balanced
   * - FBR < 1.0: Bottleneck forming (Backlog accumulating)
   * - FBR > 1.0: Clearing backlog
   */
  async calculateFlowBalanceRatio(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    // Inflow Volume (Vin): Total files arriving at the desk
    const inflow = await this.prisma.fileMovement.count({
      where: {
        deskId,
        arrivalTS: { gte: start, lte: now },
      },
    });

    // Throughput (Vout): Total files completed and sent to the next stage
    const outflow = await this.prisma.fileMovement.count({
      where: {
        deskId,
        endTS: { gte: start, lte: now },
        status: 'COMPLETED',
      },
    });

    // Flow Balance Ratio
    const fbr = inflow > 0 ? outflow / inflow : 0;
    return Math.round(fbr * 100) / 100;
  }

  /**
   * Calculate Average Handling Time (AHT)
   * AHT = Total Files Processed / SUM(End_TS - Start_TS)
   */
  async calculateAverageHandlingTime(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const movements = await this.prisma.fileMovement.findMany({
      where: {
        deskId,
        startTS: { not: null },
        endTS: { not: null, gte: start, lte: now },
        status: 'COMPLETED',
      },
    });

    if (movements.length === 0) return 0;

    const totalTime = movements.reduce((sum, m) => {
      if (m.startTS && m.endTS) {
        return sum + (m.endTS.getTime() - m.startTS.getTime());
      }
      return sum;
    }, 0);

    // Return in hours
    return Math.round((totalTime / movements.length / (1000 * 60 * 60)) * 100) / 100;
  }

  /**
   * Calculate Processing Efficiency Rate: Files processed per man-hour
   */
  async calculateProcessingEfficiencyRate(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const filesProcessed = await this.prisma.fileMovement.count({
      where: {
        deskId,
        endTS: { gte: start, lte: now },
        status: 'COMPLETED',
      },
    });

    // Estimate man-hours (assuming 8 hours per day)
    const hoursDiff = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    const manHours = hoursDiff * 1; // Assuming 1 person per desk

    return manHours > 0 ? Math.round((filesProcessed / manHours) * 100) / 100 : 0;
  }

  /**
   * Calculate High-Speed Index (HSI)
   * HSI = (Category Average Throughput / Desk Throughput) × 100
   * >100 indicates the desk is faster than average
   */
  async calculateHighSpeedIndex(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get desk throughput
    const deskThroughput = await this.prisma.fileMovement.count({
      where: {
        deskId,
        endTS: { gte: start, lte: now },
        status: 'COMPLETED',
      },
    });

    // Get category average (all desks in same department)
    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      select: { departmentId: true },
    });

    if (!desk) return 0;

    const allDesks = await this.prisma.desk.findMany({
      where: { departmentId: desk.departmentId, isActive: true },
      select: { id: true },
    });

    const allThroughputs = await Promise.all(
      allDesks.map((d) =>
        this.prisma.fileMovement.count({
          where: {
            deskId: d.id,
            endTS: { gte: start, lte: now },
            status: 'COMPLETED',
          },
        }),
      ),
    );

    const categoryAverage =
      allThroughputs.length > 0
        ? allThroughputs.reduce((a, b) => a + b, 0) / allThroughputs.length
        : 1;

    const hsi = categoryAverage > 0 ? (categoryAverage / deskThroughput) * 100 : 0;
    return Math.round(hsi * 100) / 100;
  }

  /**
   * Calculate Net Accumulation: Vin - Vout
   */
  async calculateNetAccumulation(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const inflow = await this.prisma.fileMovement.count({
      where: {
        deskId,
        arrivalTS: { gte: start, lte: now },
      },
    });

    const outflow = await this.prisma.fileMovement.count({
      where: {
        deskId,
        endTS: { gte: start, lte: now },
        status: 'COMPLETED',
      },
    });

    return inflow - outflow;
  }

  /**
   * Calculate Aged Backlog: Count of files where (Current Time - Arrival TS) > SLA_Norm
   */
  async calculateAgedBacklog(deskId: string): Promise<number> {
    const now = new Date();
    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      select: { slaNorm: true },
    });

    if (!desk || !desk.slaNorm) return 0;

    const slaNormMs = desk.slaNorm * 60 * 60 * 1000; // Convert hours to milliseconds

    const agedFiles = await this.prisma.fileMovement.count({
      where: {
        deskId,
        status: { in: ['PENDING', 'IN_PROCESS'] },
        arrivalTS: { lte: new Date(now.getTime() - slaNormMs) },
      },
    });

    return agedFiles;
  }

  /**
   * Calculate Backlog Growth Rate: Percentage increase in pending files day-over-day
   */
  async calculateBacklogGrowthRate(deskId: string): Promise<number> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const todayBacklog = await this.prisma.fileMovement.count({
      where: {
        deskId,
        status: { in: ['PENDING', 'IN_PROCESS'] },
        arrivalTS: { lte: now },
      },
    });

    const yesterdayBacklog = await this.prisma.fileMovement.count({
      where: {
        deskId,
        status: { in: ['PENDING', 'IN_PROCESS'] },
        arrivalTS: { lte: yesterday, gte: twoDaysAgo },
      },
    });

    if (yesterdayBacklog === 0) return todayBacklog > 0 ? 100 : 0;

    const growthRate = ((todayBacklog - yesterdayBacklog) / yesterdayBacklog) * 100;
    return Math.round(growthRate * 100) / 100;
  }

  /**
   * Calculate SLA Breach Percentage
   * Breach % = (Files exceeding Norm / Total Files Processed) × 100
   */
  async calculateSLABreachPercentage(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      select: { slaNorm: true },
    });

    if (!desk || !desk.slaNorm) return 0;

    const slaNormMs = desk.slaNorm * 60 * 60 * 1000;

    const totalProcessed = await this.prisma.fileMovement.count({
      where: {
        deskId,
        endTS: { gte: start, lte: now },
        status: 'COMPLETED',
      },
    });

    if (totalProcessed === 0) return 0;

    const breachedFiles = await this.prisma.fileMovement.count({
      where: {
        deskId,
        endTS: { gte: start, lte: now },
        status: 'COMPLETED',
        startTS: { not: null },
      },
    });

    // Check which files exceeded SLA
    const movements = await this.prisma.fileMovement.findMany({
      where: {
        deskId,
        endTS: { gte: start, lte: now },
        status: 'COMPLETED',
        startTS: { not: null },
      },
    });

    const breachedCount = movements.filter((m) => {
      if (m.startTS && m.endTS) {
        const duration = m.endTS.getTime() - m.startTS.getTime();
        return duration > slaNormMs;
      }
      return false;
    }).length;

    return totalProcessed > 0 ? Math.round((breachedCount / totalProcessed) * 100 * 100) / 100 : 0;
  }

  /**
   * Calculate Overstay Factor: For pending files, how many times over the SLA limit are they?
   * Factor = Current Duration / SLA Norm
   */
  async calculateOverstayFactor(fileId: string): Promise<number> {
    const movement = await this.prisma.fileMovement.findFirst({
      where: {
        fileId,
        status: { in: ['PENDING', 'IN_PROCESS'] },
      },
      orderBy: { arrivalTS: 'desc' },
      include: { desk: { select: { slaNorm: true } } },
    });

    if (!movement || !movement.desk.slaNorm) return 0;

    const now = new Date();
    const currentDuration = now.getTime() - movement.arrivalTS.getTime();
    const slaNormMs = movement.desk.slaNorm * 60 * 60 * 1000;

    return slaNormMs > 0 ? Math.round((currentDuration / slaNormMs) * 100) / 100 : 0;
  }

  /**
   * Calculate Work in Progress (WIP) Load: Files currently in "In-Process" status
   */
  async calculateWIPLoad(deskId: string): Promise<number> {
    return this.prisma.fileMovement.count({
      where: {
        deskId,
        status: 'IN_PROCESS',
      },
    });
  }

  /**
   * Calculate Desk Performance Score (0-100)
   * Weighted Scoring Components:
   * - Capacity Score (20%): Total Volume Handled
   * - Velocity Score (30%): Average Handling Time (inverse)
   * - Discipline Score (20%): Backlog Volume (0 Backlog = Max Score)
   * - Reliability Score (30%): SLA Compliance %
   */
  async calculateDeskScore(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    score: number;
    capacityScore: number;
    velocityScore: number;
    disciplineScore: number;
    reliabilityScore: number;
    category: string;
  }> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

    // Get all desks in same department for percentile ranking
    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      select: { departmentId: true },
    });

    if (!desk) {
      throw new Error('Desk not found');
    }

    const allDesks = await this.prisma.desk.findMany({
      where: { departmentId: desk.departmentId, isActive: true },
      select: { id: true },
    });

    // Calculate metrics for all desks
    const allDeskMetrics = await Promise.all(
      allDesks.map(async (d) => {
        const volume = await this.prisma.fileMovement.count({
          where: {
            deskId: d.id,
            endTS: { gte: start, lte: now },
            status: 'COMPLETED',
          },
        });

        const aht = await this.calculateAverageHandlingTime(d.id, start, now);
        const backlog = await this.calculateAgedBacklog(d.id);
        const slaBreach = await this.calculateSLABreachPercentage(d.id, start, now);

        return {
          deskId: d.id,
          volume,
          aht,
          backlog,
          slaBreach,
        };
      }),
    );

    // Find current desk metrics
    const currentDeskMetrics = allDeskMetrics.find((m) => m.deskId === deskId);
    if (!currentDeskMetrics) {
      throw new Error('Desk metrics not found');
    }

    // 1. Capacity Score (20%): Percentile rank against other desks
    const volumes = allDeskMetrics.map((m) => m.volume).sort((a, b) => b - a);
    const volumeRank = volumes.indexOf(currentDeskMetrics.volume) + 1;
    const capacityScore = volumes.length > 0
      ? ((volumes.length - volumeRank + 1) / volumes.length) * 100
      : 0;

    // 2. Velocity Score (30%): Inverse of AHT (lower time = higher score)
    const ahts = allDeskMetrics.map((m) => m.aht || 999).sort((a, b) => a - b);
    const ahtRank = ahts.indexOf(currentDeskMetrics.aht || 999) + 1;
    const velocityScore = ahts.length > 0
      ? ((ahts.length - ahtRank + 1) / ahts.length) * 100
      : 0;

    // 3. Discipline Score (20%): 0 Backlog = Max Score, penalty for every aged file
    const maxBacklog = Math.max(...allDeskMetrics.map((m) => m.backlog), 1);
    const disciplineScore = maxBacklog > 0
      ? Math.max(0, 100 - (currentDeskMetrics.backlog / maxBacklog) * 100)
      : 100;

    // 4. Reliability Score (30%): SLA Compliance % (100 - Breach % × Penalty Factor)
    const reliabilityScore = Math.max(0, 100 - currentDeskMetrics.slaBreach * 2);

    // Apply Toxic File Penalty: Subtract 5 points for every Red-Listed file
    const toxicFileCount = await this.fileRedListService.getToxicFilePenaltyCount(deskId);
    const toxicPenalty = toxicFileCount * 5;

    // Calculate weighted final score
    const finalScore =
      capacityScore * 0.2 +
      velocityScore * 0.3 +
      disciplineScore * 0.2 +
      reliabilityScore * 0.3 -
      toxicPenalty;

    const score = Math.max(0, Math.min(100, Math.round(finalScore * 100) / 100));

    // Determine category
    let category = 'BALANCED';
    if (score >= 90) category = 'ELITE';
    else if (score >= 70) category = 'HIGH_VOLUME_LOW_SPEED';
    else if (score >= 50) category = 'BALANCED';
    else if (score >= 30) category = 'AT_RISK';
    else category = 'RED_LISTED';

    return {
      score,
      capacityScore: Math.round(capacityScore * 100) / 100,
      velocityScore: Math.round(velocityScore * 100) / 100,
      disciplineScore: Math.round(disciplineScore * 100) / 100,
      reliabilityScore: Math.round(reliabilityScore * 100) / 100,
      category,
    };
  }

  /**
   * Check and apply Red-Listing Trigger Rules for desks
   * Desk is automatically Red-Listed if:
   * - SLA Breach % > 40% for 3 consecutive days
   * - More than 5 files remain untouched for > 7 days
   * - Flow Balance Ratio < 0.5 (Output is half of Input) for 2 days
   */
  async checkDeskRedListTriggers(deskId: string): Promise<{
    shouldRedList: boolean;
    reason?: string;
  }> {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Check 1: SLA Breach % > 40% for 3 consecutive days
    const slaBreach1 = await this.calculateSLABreachPercentage(deskId, threeDaysAgo, twoDaysAgo);
    const slaBreach2 = await this.calculateSLABreachPercentage(deskId, twoDaysAgo, new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const slaBreach3 = await this.calculateSLABreachPercentage(deskId, new Date(now.getTime() - 24 * 60 * 60 * 1000), now);

    if (slaBreach1 > 40 && slaBreach2 > 40 && slaBreach3 > 40) {
      return {
        shouldRedList: true,
        reason: 'SLA Breach % > 40% for 3 consecutive days',
      };
    }

    // Check 2: More than 5 files remain untouched for > 7 days
    const untouchedFiles = await this.prisma.fileMovement.count({
      where: {
        deskId,
        status: { in: ['PENDING', 'IN_PROCESS'] },
        arrivalTS: { lte: sevenDaysAgo },
        startTS: null, // Never started
      },
    });

    if (untouchedFiles > 5) {
      return {
        shouldRedList: true,
        reason: `More than 5 files remain untouched for > 7 days (${untouchedFiles} files)`,
      };
    }

    // Check 3: Flow Balance Ratio < 0.5 for 2 days
    const fbr1 = await this.calculateFlowBalanceRatio(deskId, twoDaysAgo, new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const fbr2 = await this.calculateFlowBalanceRatio(deskId, new Date(now.getTime() - 24 * 60 * 60 * 1000), now);

    if (fbr1 < 0.5 && fbr2 < 0.5) {
      return {
        shouldRedList: true,
        reason: 'Flow Balance Ratio < 0.5 (Output is half of Input) for 2 days',
      };
    }

    return { shouldRedList: false };
  }

  /**
   * Rating Analytics (0–10 scale)
   * Variables: V = volume on desk, T = allotted time/file (h), O = optimum volume, P = processed/day, R = received/day, H = working hours.
   * Speed = min(10, (P*T/H)*10), Efficiency = min(10, (P/R)*10), Workload = min(10, (V/O)*10),
   * Overload = V>O ? min(10, ((V-O)/O)*10) : 0, Underload = V<O ? min(10, ((O-V)/O)*10) : 0.
   */
  async getDeskRatingAnalytics(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    deskId: string;
    deskName: string;
    period: { from: Date; to: Date };
    variables: { V: number; T: number; O: number; P: number; R: number; H: number };
    ratings: {
      speed: number;
      efficiency: number;
      workload: number;
      overload: number;
      underload: number;
    };
    insights: string[];
  }> {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const daysInPeriod = Math.max(1, (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      select: {
        id: true,
        name: true,
        maxFilesPerDay: true,
        slaNorm: true,
      },
    });
    if (!desk) {
      throw new Error('Desk not found');
    }

    const [V, receivedTotal, processedTotal] = await Promise.all([
      this.prisma.file.count({
        where: {
          deskId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.fileMovement.count({
        where: { deskId, arrivalTS: { gte: start, lte: now } },
      }),
      this.prisma.fileMovement.count({
        where: {
          deskId,
          endTS: { gte: start, lte: now },
          status: 'COMPLETED',
        },
      }),
    ]);

    const defaultSla = await this.prisma.systemSettings.findUnique({
      where: { key: 'defaultSlaNormHours' },
      select: { value: true },
    }).catch(() => null);
    const defaultT = defaultSla ? parseInt(defaultSla.value, 10) : 2;
    const T = desk.slaNorm ?? (Number.isNaN(defaultT) ? 2 : defaultT);
    const O = Math.max(1, desk.maxFilesPerDay);
    const P = receivedTotal > 0 || processedTotal > 0 ? processedTotal / daysInPeriod : 0;
    const R = receivedTotal > 0 || processedTotal > 0 ? receivedTotal / daysInPeriod : 0;
    const H = 8;

    const cap = (x: number) => Math.min(10, Math.max(0, Math.round(x * 100) / 100));

    const speed = H > 0 && T > 0 ? cap((P * T) / H * 10) : 0;
    const efficiency = R > 0 ? cap((P / R) * 10) : (P > 0 ? 10 : 0);
    const workload = cap((V / O) * 10);
    const overload = V <= O ? 0 : cap(((V - O) / O) * 10);
    const underload = V >= O ? 0 : cap(((O - V) / O) * 10);

    const insights: string[] = [];
    if (speed < 6) insights.push('Processing slower than target rate.');
    else if (speed >= 9) insights.push('Processing at or above target rate.');
    if (efficiency < 6) insights.push('Clearing less than 60% of daily inflow; backlog may grow.');
    else if (efficiency >= 9) insights.push('Clearing most or all of daily incoming work.');
    if (workload >= 10) insights.push('Operating at or above intended capacity.');
    if (overload > 5) insights.push('Desk is overloaded; consider redistribution or capacity.');
    if (underload > 5) insights.push('Desk is underloaded; capacity may be underutilized.');

    return {
      deskId,
      deskName: desk.name,
      period: { from: start, to: now },
      variables: { V, T: Math.round(T * 100) / 100, O, P: Math.round(P * 100) / 100, R: Math.round(R * 100) / 100, H },
      ratings: { speed, efficiency, workload, overload, underload },
      insights,
    };
  }

  /**
   * Get comprehensive desk performance metrics
   */
  async getDeskPerformanceMetrics(
    deskId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    const now = dateTo || new Date();
    const start = dateFrom || new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      inflow,
      outflow,
      wip,
      fbr,
      aht,
      efficiency,
      hsi,
      netAccumulation,
      agedBacklog,
      backlogGrowth,
      slaBreach,
      deskScore,
      redListCheck,
    ] = await Promise.all([
      this.prisma.fileMovement.count({
        where: { deskId, arrivalTS: { gte: start, lte: now } },
      }),
      this.prisma.fileMovement.count({
        where: { deskId, endTS: { gte: start, lte: now }, status: 'COMPLETED' },
      }),
      this.calculateWIPLoad(deskId),
      this.calculateFlowBalanceRatio(deskId, start, now),
      this.calculateAverageHandlingTime(deskId, start, now),
      this.calculateProcessingEfficiencyRate(deskId, start, now),
      this.calculateHighSpeedIndex(deskId, start, now),
      this.calculateNetAccumulation(deskId, start, now),
      this.calculateAgedBacklog(deskId),
      this.calculateBacklogGrowthRate(deskId),
      this.calculateSLABreachPercentage(deskId, start, now),
      this.calculateDeskScore(deskId, start, now),
      this.checkDeskRedListTriggers(deskId),
    ]);

    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      include: { department: { select: { name: true } } },
    });

    return {
      deskId,
      deskName: desk?.name,
      department: desk?.department.name,
      period: { from: start, to: now },
      volumeMetrics: {
        inflow,
        outflow,
        wip,
      },
      processingRate: {
        averageHandlingTimeHours: aht,
        processingEfficiencyRate: efficiency,
        highSpeedIndex: hsi,
      },
      flowMetrics: {
        flowBalanceRatio: fbr,
        netAccumulation,
      },
      backlogMetrics: {
        agedBacklog,
        backlogGrowthRate: backlogGrowth,
      },
      slaMetrics: {
        breachPercentage: slaBreach,
      },
      performanceScore: deskScore,
      redListStatus: {
        isRedListed: redListCheck.shouldRedList,
        reason: redListCheck.reason,
      },
    };
  }
}

