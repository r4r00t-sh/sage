import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class GamificationService {
  // Default thresholds (can be overridden by SystemSettings)
  private readonly DEFAULT_BASE_POINTS = 1000;
  private readonly DEFAULT_REDLIST_PENALTY = 50;
  private readonly DEFAULT_MONTHLY_BONUS = 100;
  private readonly DEFAULT_REDLIST_WARNING_THRESHOLD = 3; // files before marked
  private readonly DEFAULT_REDLIST_SEVERE_THRESHOLD = 5; // files before severe marking

  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitMQService,
  ) {}

  async initializeUserPoints(userId: string): Promise<void> {
    const basePoints = await this.getSetting(
      'base_points',
      this.DEFAULT_BASE_POINTS,
    );

    await this.prisma.userPoints.upsert({
      where: { userId },
      create: {
        userId,
        basePoints,
        currentPoints: basePoints,
      },
      update: {},
    });
  }

  async deductForRedList(
    userId: string,
    fileId: string,
    fileNumber: string,
  ): Promise<void> {
    const penalty = await this.getSetting(
      'redlist_penalty',
      this.DEFAULT_REDLIST_PENALTY,
    );

    // Update user points
    const userPoints = await this.prisma.userPoints.update({
      where: { userId },
      data: {
        currentPoints: { decrement: penalty },
        redListDeductions: { increment: penalty },
        redListCount: { increment: 1 },
      },
    });

    // Log the transaction
    await this.prisma.pointsTransaction.create({
      data: {
        userId,
        amount: -penalty,
        reason: 'redlist_penalty',
        fileId,
        description: `Red list penalty for file ${fileNumber}`,
      },
    });

    // Check thresholds for user marking
    const warningThreshold = await this.getSetting(
      'redlist_warning_threshold',
      this.DEFAULT_REDLIST_WARNING_THRESHOLD,
    );
    const severeThreshold = await this.getSetting(
      'redlist_severe_threshold',
      this.DEFAULT_REDLIST_SEVERE_THRESHOLD,
    );

    if (userPoints.redListCount >= severeThreshold) {
      // Notify admins about severe case
      await this.notifyAdminsAboutUser(
        userId,
        'severe_redlist',
        userPoints.redListCount,
      );
    } else if (userPoints.redListCount >= warningThreshold) {
      // Notify admins about warning
      await this.notifyAdminsAboutUser(
        userId,
        'warning_redlist',
        userPoints.redListCount,
      );
    }
  }

  // Monthly bonus check - runs at midnight on the 1st of each month
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async processMonthlyBonuses(): Promise<void> {
    console.log('Processing monthly bonuses...');

    const monthlyBonus = await this.getSetting(
      'monthly_bonus',
      this.DEFAULT_MONTHLY_BONUS,
    );
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Find users who had zero redlist files last month
    const allUserPoints = await this.prisma.userPoints.findMany({
      include: {
        user: { select: { id: true, name: true, departmentId: true } },
      },
    });

    for (const userPoints of allUserPoints) {
      // Check if user had any redlist files last month
      const redlistCount = await this.prisma.file.count({
        where: {
          assignedToId: userPoints.userId,
          isRedListed: true,
          redListedAt: {
            gte: lastMonth,
            lt: now,
          },
        },
      });

      if (redlistCount === 0) {
        // Award monthly bonus
        await this.prisma.userPoints.update({
          where: { userId: userPoints.userId },
          data: {
            currentPoints: { increment: monthlyBonus },
            monthlyBonus: { increment: monthlyBonus },
            streakMonths: { increment: 1 },
            lastMonthReset: now,
          },
        });

        // Log the transaction
        await this.prisma.pointsTransaction.create({
          data: {
            userId: userPoints.userId,
            amount: monthlyBonus,
            reason: 'monthly_bonus',
            description: `Monthly bonus - no red list files`,
          },
        });
      } else {
        // Reset streak
        await this.prisma.userPoints.update({
          where: { userId: userPoints.userId },
          data: {
            streakMonths: 0,
            lastMonthReset: now,
          },
        });
      }

      // Reset monthly redlist count
      await this.prisma.userPoints.update({
        where: { userId: userPoints.userId },
        data: { redListCount: 0 },
      });
    }

    console.log('Monthly bonuses processed');
  }

  async getUserPoints(userId: string) {
    let userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!userPoints) {
      await this.initializeUserPoints(userId);
      userPoints = await this.prisma.userPoints.findUnique({
        where: { userId },
      });
    }

    return userPoints;
  }

  async getPointsHistory(userId: string, limit = 50) {
    return this.prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async manualAdjustPoints(
    userId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    await this.prisma.userPoints.update({
      where: { userId },
      data: {
        currentPoints: { increment: amount },
      },
    });

    await this.prisma.pointsTransaction.create({
      data: {
        userId,
        amount,
        reason: 'manual_adjustment',
        description: reason,
        createdById: adminId,
      },
    });
  }

  private async getSetting(key: string, defaultValue: number): Promise<number> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { key },
    });
    return setting ? parseInt(setting.value) : defaultValue;
  }

  private async notifyAdminsAboutUser(
    userId: string,
    type: 'warning_redlist' | 'severe_redlist',
    count: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, departmentId: true },
    });

    if (!user) return;

    const admins = await this.prisma.user.findMany({
      where: {
        OR: [
          { roles: { has: 'DEVELOPER' } },
        { roles: { has: 'SUPER_ADMIN' } },
          { roles: { has: 'DEPT_ADMIN' }, departmentId: user.departmentId },
        ],
        isActive: true,
      },
      select: { id: true },
    });

    const title =
      type === 'severe_redlist'
        ? 'User Performance Alert - Severe'
        : 'User Performance Alert';
    const message =
      type === 'severe_redlist'
        ? `${user.name} has ${count} red listed files this month - immediate attention required`
        : `${user.name} has ${count} red listed files this month`;

    const toastType =
      type === 'severe_redlist'
        ? ('admin_user_severe_redlist' as const)
        : ('admin_user_warning_redlist' as const);

    for (const admin of admins) {
      await this.rabbitmq.publishToast({
        userId: admin.id,
        type: toastType,
        title,
        message,
      });
    }
  }

  // Legacy method for backward compatibility
  async checkAndAwardStreak(userId: string): Promise<void> {
    // Now handled by the monthly cron job
    const userPoints = await this.getUserPoints(userId);
    if (userPoints) {
      console.log(`User ${userId} streak: ${userPoints.streakMonths} months`);
    }
  }
}
