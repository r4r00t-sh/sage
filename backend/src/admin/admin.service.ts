import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly HEARTBEAT_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  constructor(private prisma: PrismaService) {}

  /** File/user department filter for DEPT_ADMIN (not super/dev). */
  private deptAdminScopeWhere(
    userRoles: string[],
    departmentId: string | null | undefined,
    departmentIds?: string[],
  ): { departmentId: string | { in: string[] } } | null {
    if (
      !userRoles.includes('DEPT_ADMIN') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('DEVELOPER')
    ) {
      return null;
    }
    if (departmentIds?.length) {
      return { departmentId: { in: departmentIds } };
    }
    if (departmentId) {
      return { departmentId };
    }
    return null;
  }

  // Get active desk status for department admin
  async getDeskStatus(
    departmentId: string | null,
    userRoles: string[],
    departmentIds?: string[],
  ) {
    // Build query based on role
    const where: any = { isActive: true };

    const scope = this.deptAdminScopeWhere(userRoles, departmentId, departmentIds);
    if (scope) {
      Object.assign(where, scope);
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
    departmentIds?: string[],
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

    const scope = this.deptAdminScopeWhere(userRoles, departmentId, departmentIds);
    if (scope) {
      Object.assign(where, scope);
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
  async getAnalytics(
    departmentId: string | null,
    userRoles: string[],
    departmentIds?: string[],
  ) {
    const where: any = {};
    const scope = this.deptAdminScopeWhere(userRoles, departmentId ?? undefined, departmentIds);
    if (scope) {
      Object.assign(where, scope);
    }

    const userPointsQuery: any = {};
    if (
      userRoles.includes('DEPT_ADMIN') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER')
    ) {
      if (departmentIds?.length) {
        userPointsQuery.user = { departmentId: { in: departmentIds } };
      } else if (departmentId) {
        userPointsQuery.user = { departmentId };
      }
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
      (() => {
        let extReqWhere: { file: { departmentId: string | { in: string[] } } } | Record<string, never> =
          {};
        if (
          userRoles.includes('DEPT_ADMIN') &&
          !userRoles.includes('SUPER_ADMIN') &&
          !userRoles.includes('DEVELOPER')
        ) {
          if (departmentIds?.length) {
            extReqWhere = { file: { departmentId: { in: departmentIds } } };
          } else if (departmentId) {
            extReqWhere = { file: { departmentId } };
          }
        }
        return this.prisma.timeExtensionRequest.count({ where: extReqWhere });
      })(),
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

  // Get system settings (Super Admin: all; Dept Admin: global + their department)
  async getSettings(departmentId?: string, departmentIds?: string[]) {
    const where: any = {};
    if (departmentIds?.length) {
      where.OR = [
        { departmentId: null },
        ...departmentIds.map((id) => ({ departmentId: id })),
      ];
    } else if (departmentId) {
      where.OR = [{ departmentId: null }, { departmentId }];
    }
    return this.prisma.systemSettings.findMany({
      where,
      orderBy: [{ key: 'asc' }, { departmentId: 'asc' }],
      include: {
        department: { select: { id: true, name: true, code: true } },
        updatedBy: { select: { id: true, name: true, username: true } },
      },
    });
  }

  // Update system setting (departmentId: null = global, set = per-department). Logs to audit.
  // Prisma composite unique rejects null at runtime, so for global (scopeId null) we use findFirst + update/create by id.
  async updateSetting(
    key: string,
    value: string,
    userId: string,
    departmentId?: string | null,
  ) {
    const scopeId = departmentId ?? null;
    let previousValue: string | null = null;
    let updated: { id: string; key: string; value: string; departmentId: string | null };

    if (scopeId === null) {
      const existing = await this.prisma.systemSettings.findFirst({
        where: { key, departmentId: null },
        select: { id: true, value: true },
      });
      previousValue = existing?.value ?? null;
      if (existing) {
        updated = await this.prisma.systemSettings.update({
          where: { id: existing.id },
          data: { value, updatedById: userId },
        });
      } else {
        updated = await this.prisma.systemSettings.create({
          data: { key, value, departmentId: null, updatedById: userId },
        });
      }
    } else {
      const existing = await this.prisma.systemSettings.findUnique({
        where: { key_departmentId: { key, departmentId: scopeId } },
        select: { value: true },
      });
      previousValue = existing?.value ?? null;
      updated = await this.prisma.systemSettings.upsert({
        where: { key_departmentId: { key, departmentId: scopeId } },
        create: { key, value, departmentId: scopeId, updatedById: userId },
        update: { value, updatedById: userId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'setting_updated',
        entityType: 'SystemSetting',
        entityId: scopeId ? `${key}:${scopeId}` : key,
        userId,
        metadata: {
          key,
          departmentId: scopeId,
          value,
          previousValue,
        },
      },
    });

    return updated;
  }

  // Get recent system setting changes for activity log (Super Admin: all; Dept Admin: global + their dept)
  async getSettingsActivity(
    departmentId?: string | null,
    limit = 30,
    departmentIds?: string[],
  ) {
    const where: any = { entityType: 'SystemSetting' };
    if (departmentIds?.length) {
      where.OR = [
        { metadata: { path: ['departmentId'], equals: null } },
        ...departmentIds.map((id) => ({
          metadata: { path: ['departmentId'], equals: id },
        })),
      ];
    } else if (departmentId) {
      where.OR = [
        { metadata: { path: ['departmentId'], equals: departmentId } },
        { metadata: { path: ['departmentId'], equals: null } },
      ];
    }
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });
    return logs;
  }

  // Get extension requests for admin view
  async getExtensionRequests(
    departmentId: string | null,
    userRoles: string[],
    departmentIds?: string[],
  ) {
    const where: any = {};
    if (
      userRoles.includes('DEPT_ADMIN') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER')
    ) {
      if (departmentIds?.length) {
        where.file = { departmentId: { in: departmentIds } };
      } else if (departmentId) {
        where.file = { departmentId };
      }
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
  async getRedListedFiles(
    departmentId: string | null,
    userRoles: string[],
    departmentIds?: string[],
  ) {
    const where: any = { isRedListed: true };
    const scope = this.deptAdminScopeWhere(userRoles, departmentId, departmentIds);
    if (scope) {
      Object.assign(where, scope);
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

  async listOrganisations() {
    return this.prisma.organisation.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
