import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly HEARTBEAT_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  constructor(private prisma: PrismaService) {}

  // Get active desk status for department admin
  async getDeskStatus(departmentId: string, userRoles: string[]) {
    // Build query based on role
    const where: any = { isActive: true };

    if (userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEVELOPER')) {
      where.departmentId = departmentId;
    }
    // SUPER_ADMIN sees all

    const users = await this.prisma.user.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        division: { select: { id: true, name: true, code: true } },
        presence: true,
        _count: {
          select: {
            filesAssigned: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            },
          },
        },
      },
      orderBy: [
        { department: { name: 'asc' } },
        { division: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    const now = Date.now();
    return users.map((user) => {
      let status: PresenceStatus = PresenceStatus.ABSENT;
      let statusLabel = 'Absent';
      let logoutType: string | null = null;

      if (user.presence && user.presence.length > 0) {
        const presence = user.presence[0];
        const timeSinceLastPing = now - presence.lastPing.getTime();

        if (timeSinceLastPing <= this.HEARTBEAT_TIMEOUT) {
          status = PresenceStatus.ACTIVE;
          statusLabel = 'Active';
        } else if (presence.logoutType === 'manual') {
          status = PresenceStatus.ABSENT;
          statusLabel = 'Logged Out';
          logoutType = 'manual';
        } else {
          status = PresenceStatus.SESSION_TIMEOUT;
          statusLabel = 'Session Expired';
          logoutType = 'session_timeout';
        }
      }

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        roles: user.roles,
        department: user.department,
        division: user.division,
        status,
        statusLabel,
        logoutType,
        lastPing: user.presence?.[0]?.lastPing,
        loginTime: user.presence?.[0]?.loginTime,
        logoutTime: user.presence?.[0]?.logoutTime,
        pendingFiles: user._count.filesAssigned,
      };
    });
  }

  // Get department files for admin
  async getDepartmentFiles(
    departmentId: string | null,
    userRoles: string[],
    filters: {
      status?: string;
      search?: string;
      isRedListed?: boolean;
      assignedToId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const {
      status,
      search,
      isRedListed,
      assignedToId,
      page = 1,
      limit = 50,
    } = filters;
    const where: any = {};

    // Role-based filtering
    if (userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && departmentId) {
      where.departmentId = departmentId;
    }
    // SUPER_ADMIN sees all

    if (status) where.status = status;
    if (isRedListed !== undefined) where.isRedListed = isRedListed;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { fileNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          currentDivision: { select: { id: true, name: true, code: true } },
          assignedTo: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ isRedListed: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get analytics data
  async getAnalytics(departmentId: string | null, userRoles: string[]) {
    const where: any = {};
    if (userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && departmentId) {
      where.departmentId = departmentId;
    }

    // Get user points stats
    const userPointsQuery: any = {};
    if (departmentId && userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEVELOPER')) {
      userPointsQuery.user = { departmentId };
    }

    const [
      totalFiles,
      pendingFiles,
      redListedFiles,
      completedFiles,
      userPoints,
      extensionRequests,
      avgProcessingTime,
    ] = await Promise.all([
      this.prisma.file.count({ where }),
      this.prisma.file.count({
        where: { ...where, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      this.prisma.file.count({ where: { ...where, isRedListed: true } }),
      this.prisma.file.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.userPoints.findMany({
        where: userPointsQuery,
        include: {
          user: {
            select: { id: true, name: true, roles: true, departmentId: true },
          },
        },
        orderBy: { currentPoints: 'desc' },
      }),
      this.prisma.timeExtensionRequest.count({
        where:
          departmentId && userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEVELOPER')
            ? { file: { departmentId } }
            : {},
      }),
      this.prisma.file.aggregate({
        where: {
          ...where,
          status: 'APPROVED',
          totalProcessingTime: { not: null },
        },
        _avg: { totalProcessingTime: true },
      }),
    ]);

    // Calculate scores
    const scores = userPoints.map((up) => ({
      userId: up.userId,
      userName: up.user.name,
      roles: up.user.roles,
      currentPoints: up.currentPoints,
      basePoints: up.basePoints,
      redListCount: up.redListCount,
      monthlyBonus: up.monthlyBonus,
      streakMonths: up.streakMonths,
    }));

    const avgScore =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s.currentPoints, 0) / scores.length
        : 0;

    return {
      summary: {
        totalFiles,
        pendingFiles,
        redListedFiles,
        completedFiles,
        extensionRequests,
        avgProcessingTimeHours: avgProcessingTime._avg.totalProcessingTime
          ? Math.round(
              (avgProcessingTime._avg.totalProcessingTime / 3600) * 10,
            ) / 10
          : null,
      },
      scores: {
        highest: scores[0] || null,
        lowest: scores[scores.length - 1] || null,
        average: Math.round(avgScore),
        all: scores,
      },
    };
  }

  // Get department-wise analytics (Super Admin only)
  async getDepartmentWiseAnalytics() {
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

    const deptStats = await Promise.all(
      departments.map(async (dept) => {
        const [pendingCount, redListCount, completedCount, avgProcessingTime] =
          await Promise.all([
            this.prisma.file.count({
              where: {
                departmentId: dept.id,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
              },
            }),
            this.prisma.file.count({
              where: { departmentId: dept.id, isRedListed: true },
            }),
            this.prisma.file.count({
              where: { departmentId: dept.id, status: 'APPROVED' },
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

        // Get avg user points for department
        const deptUserPoints = await this.prisma.userPoints.aggregate({
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
          redListedFiles: redListCount,
          completedFiles: completedCount,
          avgProcessingTimeHours: avgProcessingTime._avg.totalProcessingTime
            ? Math.round(
                (avgProcessingTime._avg.totalProcessingTime / 3600) * 10,
              ) / 10
            : null,
          avgUserPoints: Math.round(deptUserPoints._avg.currentPoints || 0),
        };
      }),
    );

    return deptStats;
  }

  // Get system settings
  async getSettings(departmentId?: string) {
    const where: any = {};
    if (departmentId) {
      where.OR = [{ departmentId: null }, { departmentId }];
    }

    return this.prisma.systemSettings.findMany({ where });
  }

  // Update system setting
  async updateSetting(
    key: string,
    value: string,
    userId: string,
    departmentId?: string,
  ) {
    return this.prisma.systemSettings.upsert({
      where: { key },
      create: {
        key,
        value,
        departmentId,
        updatedById: userId,
      },
      update: {
        value,
        updatedById: userId,
      },
    });
  }

  // Get extension requests for admin view
  async getExtensionRequests(departmentId: string | null, userRoles: string[]) {
    const where: any = {};
    if (userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && departmentId) {
      where.file = { departmentId };
    }

    return this.prisma.timeExtensionRequest.findMany({
      where,
      include: {
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
            departmentId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // Get red listed files
  async getRedListedFiles(departmentId: string | null, userRoles: string[]) {
    const where: any = { isRedListed: true };
    if (userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && departmentId) {
      where.departmentId = departmentId;
    }

    return this.prisma.file.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true } },
        currentDivision: { select: { id: true, name: true } },
      },
      orderBy: { redListedAt: 'desc' },
    });
  }
}
