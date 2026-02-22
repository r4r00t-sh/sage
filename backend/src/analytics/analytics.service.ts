import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Get comprehensive dashboard analytics
  async getDashboardAnalytics(
    departmentId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const whereBase: any = {};
    if (departmentId) whereBase.departmentId = departmentId;
    if (dateFrom || dateTo) whereBase.createdAt = dateFilter;

    // Core metrics
    const [
      totalFiles,
      pendingFiles,
      inProgressFiles,
      completedFiles,
      rejectedFiles,
      redListedFiles,
      onHoldFiles,
      totalUsers,
      activeUsersToday,
    ] = await Promise.all([
      this.prisma.file.count({ where: whereBase }),
      this.prisma.file.count({ where: { ...whereBase, status: 'PENDING' } }),
      this.prisma.file.count({
        where: { ...whereBase, status: 'IN_PROGRESS' },
      }),
      this.prisma.file.count({ where: { ...whereBase, status: 'APPROVED' } }),
      this.prisma.file.count({ where: { ...whereBase, status: 'REJECTED' } }),
      this.prisma.file.count({ where: { ...whereBase, isRedListed: true } }),
      this.prisma.file.count({ where: { ...whereBase, isOnHold: true } }),
      this.prisma.user.count({ where: departmentId ? { departmentId } : {} }),
      this.prisma.presence.count({
        where: {
          status: 'ACTIVE',
          lastPing: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ...(departmentId ? { user: { departmentId } } : {}),
        },
      }),
    ]);

    // Processing time analytics
    const avgProcessingTime = await this.prisma.file.aggregate({
      where: {
        ...whereBase,
        status: 'APPROVED',
        totalProcessingTime: { not: null },
      },
      _avg: { totalProcessingTime: true },
    });

    // Files by priority
    const filesByPriority = await this.prisma.file.groupBy({
      by: ['priority'],
      where: whereBase,
      _count: { id: true },
    });

    // Files by priority category
    const filesByPriorityCategory = await this.prisma.file.groupBy({
      by: ['priorityCategory'],
      where: whereBase,
      _count: { id: true },
    });

    // Files created per day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let filesPerDay: any[] = [];
    try {
      if (departmentId) {
        filesPerDay = await this.prisma.$queryRaw`
          SELECT 
            DATE("createdAt") as date,
            COUNT(*)::int as count
          FROM "File"
          WHERE "createdAt" >= ${thirtyDaysAgo}
          AND "departmentId" = ${departmentId}
          GROUP BY DATE("createdAt")
          ORDER BY date DESC
          LIMIT 30
        `;
      } else {
        filesPerDay = await this.prisma.$queryRaw`
          SELECT 
            DATE("createdAt") as date,
            COUNT(*)::int as count
          FROM "File"
          WHERE "createdAt" >= ${thirtyDaysAgo}
          GROUP BY DATE("createdAt")
          ORDER BY date DESC
          LIMIT 30
        `;
      }
    } catch (e) {
      // Fallback if raw query fails
      filesPerDay = [];
    }

    // Extension requests stats
    const extensionStats = await this.prisma.timeExtensionRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return {
      summary: {
        totalFiles,
        pendingFiles,
        inProgressFiles,
        completedFiles,
        rejectedFiles,
        redListedFiles,
        onHoldFiles,
        totalUsers,
        activeUsersToday,
        avgProcessingTimeHours: avgProcessingTime._avg.totalProcessingTime
          ? Math.round(
              (avgProcessingTime._avg.totalProcessingTime / 3600) * 10,
            ) / 10
          : null,
        completionRate:
          totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
        redListRate:
          totalFiles > 0 ? Math.round((redListedFiles / totalFiles) * 100) : 0,
      },
      filesByPriority: filesByPriority.map((p) => ({
        priority: p.priority,
        count: p._count.id,
      })),
      filesByPriorityCategory: filesByPriorityCategory.map((p) => ({
        category: p.priorityCategory,
        count: p._count.id,
      })),
      filesPerDay,
      extensionStats: extensionStats.map((e) => ({
        status: e.status,
        count: e._count.id,
      })),
    };
  }

  // Get department-wise analytics
  async getDepartmentAnalytics() {
    const departments = await this.prisma.department.findMany({
      include: {
        _count: {
          select: {
            files: true,
            users: true,
          },
        },
      },
    });

    const deptAnalytics = await Promise.all(
      departments.map(async (dept) => {
        const [
          pendingCount,
          inProgressCount,
          completedCount,
          redListCount,
          avgProcessingTime,
        ] = await Promise.all([
          this.prisma.file.count({
            where: { departmentId: dept.id, status: 'PENDING' },
          }),
          this.prisma.file.count({
            where: { departmentId: dept.id, status: 'IN_PROGRESS' },
          }),
          this.prisma.file.count({
            where: { departmentId: dept.id, status: 'APPROVED' },
          }),
          this.prisma.file.count({
            where: { departmentId: dept.id, isRedListed: true },
          }),
          this.prisma.file.aggregate({
            where: {
              departmentId: dept.id,
              status: 'APPROVED',
              totalProcessingTime: { not: null },
            },
            _avg: { totalProcessingTime: true },
          }),
        ]);

        // Get department user points average
        const userPointsAvg = await this.prisma.userPoints.aggregate({
          where: { user: { departmentId: dept.id } },
          _avg: { currentPoints: true },
        });

        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          totalFiles: dept._count.files,
          totalUsers: dept._count.users,
          pendingFiles: pendingCount,
          inProgressFiles: inProgressCount,
          completedFiles: completedCount,
          redListedFiles: redListCount,
          avgProcessingTimeHours: avgProcessingTime._avg.totalProcessingTime
            ? Math.round(
                (avgProcessingTime._avg.totalProcessingTime / 3600) * 10,
              ) / 10
            : null,
          avgUserPoints: Math.round(userPointsAvg._avg.currentPoints || 0),
          efficiency:
            dept._count.files > 0
              ? Math.round((completedCount / dept._count.files) * 100)
              : 0,
        };
      }),
    );

    return deptAnalytics;
  }

  // Get user performance analytics
  async getUserPerformanceAnalytics(departmentId?: string, limit = 50) {
    const whereUser: any = { isActive: true };
    if (departmentId) whereUser.departmentId = departmentId;

    const users = await this.prisma.user.findMany({
      where: whereUser,
      include: {
        points: true,
        department: { select: { name: true, code: true } },
        division: { select: { name: true } },
        _count: {
          select: {
            filesAssigned: true,
            filesCreated: true,
          },
        },
      },
      take: limit,
    });

    const userAnalytics = await Promise.all(
      users.map(async (user) => {
        const [
          completedFiles,
          redListedFiles,
          avgProcessingTime,
          extensionRequests,
        ] = await Promise.all([
          this.prisma.file.count({
            where: { assignedToId: user.id, status: 'APPROVED' },
          }),
          this.prisma.file.count({
            where: { assignedToId: user.id, isRedListed: true },
          }),
          this.prisma.fileRouting.aggregate({
            where: { fromUserId: user.id, timeSpentAtDesk: { not: null } },
            _avg: { timeSpentAtDesk: true },
          }),
          this.prisma.timeExtensionRequest.count({
            where: { requestedById: user.id },
          }),
        ]);

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          roles: user.roles,
          department: user.department?.name,
          departmentCode: user.department?.code,
          division: user.division?.name,
          currentPoints: user.points?.currentPoints || 0,
          basePoints: user.points?.basePoints || 1000,
          streakMonths: user.points?.streakMonths || 0,
          totalFilesAssigned: user._count.filesAssigned,
          totalFilesCreated: user._count.filesCreated,
          completedFiles,
          redListedFiles,
          extensionRequests,
          avgProcessingTimeHours: avgProcessingTime._avg.timeSpentAtDesk
            ? Math.round((avgProcessingTime._avg.timeSpentAtDesk / 3600) * 10) /
              10
            : null,
          performanceScore: this.calculatePerformanceScore(
            completedFiles,
            redListedFiles,
            user.points?.currentPoints || 1000,
            extensionRequests,
          ),
        };
      }),
    );

    // Sort by performance score
    return userAnalytics.sort(
      (a, b) => b.performanceScore - a.performanceScore,
    );
  }

  /**
   * Activity heatmap (GitHub-style): contributions per day from file-related actions (AuditLog).
   * scope: 'user' = current user's file actions; 'department' = all file actions in that department.
   */
  async getActivityHeatmap(params: {
    scope: 'user' | 'department';
    userId?: string;
    departmentId?: string;
    year?: number;
  }) {
    const year = params.year ?? new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    if (params.scope === 'user' && params.userId) {
      const rows = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM "AuditLog"
        WHERE "entityType" = 'File' AND "fileId" IS NOT NULL AND "userId" = ${params.userId}
          AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `;
      const contributions: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        const key = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
        const c = Number(r.count);
        contributions[key] = c;
        total += c;
      }
      return { contributions, totalContributions: total, year };
    }

    if (params.scope === 'department' && params.departmentId) {
      const rows = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE(a."createdAt") as date, COUNT(*)::int as count
        FROM "AuditLog" a
        INNER JOIN "File" f ON f.id = a."fileId"
        WHERE a."entityType" = 'File' AND a."fileId" IS NOT NULL
          AND f."departmentId" = ${params.departmentId}
          AND a."createdAt" >= ${start} AND a."createdAt" <= ${end}
        GROUP BY DATE(a."createdAt")
        ORDER BY date
      `;
      const contributions: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        const key = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
        const c = Number(r.count);
        contributions[key] = c;
        total += c;
      }
      return { contributions, totalContributions: total, year };
    }

    return { contributions: {}, totalContributions: 0, year };
  }

  // Get file processing time breakdown
  async getProcessingTimeAnalytics(departmentId?: string) {
    const where: any = {
      status: 'APPROVED',
      totalProcessingTime: { not: null },
    };
    if (departmentId) where.departmentId = departmentId;

    // By priority category
    const byCategory = await this.prisma.file.groupBy({
      by: ['priorityCategory'],
      where,
      _avg: { totalProcessingTime: true },
      _count: { id: true },
    });

    // By department
    const byDepartment = await this.prisma.file.groupBy({
      by: ['departmentId'],
      where: { status: 'APPROVED', totalProcessingTime: { not: null } },
      _avg: { totalProcessingTime: true },
      _count: { id: true },
    });

    // Get department names
    const deptIds = byDepartment.map((d) => d.departmentId);
    const departments = await this.prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true, code: true },
    });
    const deptMap = new Map(departments.map((d) => [d.id, d]));

    return {
      byPriorityCategory: byCategory.map((c) => ({
        category: c.priorityCategory,
        avgTimeHours: c._avg.totalProcessingTime
          ? Math.round((c._avg.totalProcessingTime / 3600) * 10) / 10
          : null,
        count: c._count.id,
      })),
      byDepartment: byDepartment.map((d) => ({
        departmentId: d.departmentId,
        departmentName: deptMap.get(d.departmentId)?.name,
        departmentCode: deptMap.get(d.departmentId)?.code,
        avgTimeHours: d._avg.totalProcessingTime
          ? Math.round((d._avg.totalProcessingTime / 3600) * 10) / 10
          : null,
        count: d._count.id,
      })),
    };
  }

  // Get bottleneck analysis
  async getBottleneckAnalysis(departmentId?: string) {
    const where: any = { status: { in: ['PENDING', 'IN_PROGRESS'] } };
    if (departmentId) where.departmentId = departmentId;

    // Files stuck at each user
    const filesPerUser = await this.prisma.file.groupBy({
      by: ['assignedToId'],
      where: { ...where, assignedToId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get user details
    const userIds = filesPerUser
      .map((f) => f.assignedToId)
      .filter(Boolean) as string[];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, department: { select: { name: true } } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Files stuck at each division
    const filesPerDivision = await this.prisma.file.groupBy({
      by: ['currentDivisionId'],
      where: { ...where, currentDivisionId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get division details
    const divisionIds = filesPerDivision
      .map((f) => f.currentDivisionId)
      .filter(Boolean) as string[];
    const divisions = await this.prisma.division.findMany({
      where: { id: { in: divisionIds } },
      select: { id: true, name: true, department: { select: { name: true } } },
    });
    const divisionMap = new Map(divisions.map((d) => [d.id, d]));

    // Overdue files analysis
    const overdueFiles = await this.prisma.file.findMany({
      where: {
        ...where,
        OR: [
          { dueDate: { lt: new Date() } },
          { deskDueDate: { lt: new Date() } },
        ],
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        currentDivision: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    return {
      userBottlenecks: filesPerUser.map((f) => ({
        userId: f.assignedToId,
        userName: userMap.get(f.assignedToId!)?.name,
        department: userMap.get(f.assignedToId!)?.department?.name,
        pendingFiles: f._count.id,
      })),
      divisionBottlenecks: filesPerDivision.map((f) => ({
        divisionId: f.currentDivisionId,
        divisionName: divisionMap.get(f.currentDivisionId!)?.name,
        department: divisionMap.get(f.currentDivisionId!)?.department?.name,
        pendingFiles: f._count.id,
      })),
      overdueFiles: overdueFiles.map((f) => ({
        id: f.id,
        fileNumber: f.fileNumber,
        subject: f.subject,
        assignedTo: f.assignedTo?.name,
        division: f.currentDivision?.name,
        department: f.department.name,
        dueDate: f.dueDate,
        daysOverdue: f.dueDate
          ? Math.floor(
              (Date.now() - f.dueDate.getTime()) / (1000 * 60 * 60 * 24),
            )
          : null,
      })),
    };
  }

  // Generate report data for export
  async generateReport(
    reportType: 'summary' | 'detailed' | 'user_performance' | 'department',
    departmentId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    switch (reportType) {
      case 'summary':
        return this.getDashboardAnalytics(departmentId, dateFrom, dateTo);
      case 'detailed':
        const files = await this.prisma.file.findMany({
          where: {
            ...(departmentId ? { departmentId } : {}),
            ...(dateFrom || dateTo
              ? {
                  createdAt: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {}),
                  },
                }
              : {}),
          },
          include: {
            createdBy: { select: { name: true } },
            assignedTo: { select: { name: true } },
            department: { select: { name: true, code: true } },
            currentDivision: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        return {
          generatedAt: new Date(),
          totalRecords: files.length,
          files: files.map((f) => ({
            fileNumber: f.fileNumber,
            subject: f.subject,
            status: f.status,
            priority: f.priority,
            priorityCategory: f.priorityCategory,
            department: f.department.name,
            departmentCode: f.department.code,
            division: f.currentDivision?.name || '-',
            createdBy: f.createdBy.name,
            assignedTo: f.assignedTo?.name || 'Unassigned',
            createdAt: f.createdAt,
            dueDate: f.dueDate,
            isRedListed: f.isRedListed,
            isOnHold: f.isOnHold,
          })),
        };
      case 'user_performance':
        return {
          generatedAt: new Date(),
          users: await this.getUserPerformanceAnalytics(departmentId),
        };
      case 'department':
        return {
          generatedAt: new Date(),
          departments: await this.getDepartmentAnalytics(),
        };
      default:
        throw new Error('Invalid report type');
    }
  }

  private calculatePerformanceScore(
    completed: number,
    redListed: number,
    points: number,
    extensionRequests: number,
  ): number {
    // Weighted scoring formula
    const completedWeight = 10;
    const redListPenalty = -20;
    const pointsWeight = 0.05;
    const extensionPenalty = -5;

    let score = 50; // Base score
    score += completed * completedWeight;
    score += redListed * redListPenalty;
    score += (points - 1000) * pointsWeight; // Bonus/penalty from base
    score += extensionRequests * extensionPenalty;

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
