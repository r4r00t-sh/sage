import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import type { PeriodType } from './dto/desk-profile-query.dto';

const PERIOD_MS: Record<PeriodType, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

@Injectable()
export class DeskProfileService {
  constructor(private prisma: PrismaService) {}

  private canAccessDeskProfile(roles: string[]): boolean {
    return (
      roles.includes(UserRole.DEVELOPER) ||
      roles.includes(UserRole.SUPER_ADMIN) ||
      roles.includes(UserRole.DEPT_ADMIN) ||
      roles.includes(UserRole.INWARD_DESK) ||
      roles.includes(UserRole.DISPATCHER) ||
      roles.includes(UserRole.USER)
    );
  }

  private getDateRange(period: PeriodType, dateFrom?: Date, dateTo?: Date): { from: Date; to: Date } {
    const to = dateTo ? new Date(dateTo) : new Date();
    let from: Date;
    if (dateFrom) {
      from = new Date(dateFrom);
    } else {
      from = new Date(to.getTime() - PERIOD_MS[period]);
    }
    return { from, to };
  }

  // ---------- Volume ----------
  async getVolumeStats(params: {
    period: PeriodType;
    deskId?: string;
    departmentId?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
    roles: string[];
  }) {
    if (!this.canAccessDeskProfile(params.roles)) throw new ForbiddenException('Access denied');
    const { from, to } = this.getDateRange(params.period, params.dateFrom as any, params.dateTo as any);

    const deskWhere = params.deskId ? { deskId: params.deskId } : {};
    const deptWhere = params.departmentId ? { departmentId: params.departmentId } : {};
    const fileWhere = { ...deptWhere, isClosed: false };
    const fileWhereWithDesk = params.deskId ? { ...fileWhere, deskId: params.deskId } : fileWhere;

    const [
      totalFilesOnDesk,
      incomingCount,
      outgoingCount,
      optimumVolume,
      redListedCount,
      redListedInPeriod,
      extensionTotal,
      extensionInPeriod,
    ] = await Promise.all([
      this.prisma.file.count({ where: { ...fileWhereWithDesk, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      params.deskId
        ? this.prisma.fileMovement.count({ where: { deskId: params.deskId, arrivalTS: { gte: from, lte: to } } })
        : this.prisma.fileMovement.count({ where: { arrivalTS: { gte: from, lte: to } } }),
      params.deskId
        ? this.prisma.fileMovement.count({ where: { deskId: params.deskId, endTS: { not: null, gte: from, lte: to } } })
        : this.prisma.fileMovement.count({ where: { endTS: { not: null, gte: from, lte: to } } }),
      params.deskId
        ? this.prisma.desk.findUnique({ where: { id: params.deskId }, select: { maxFilesPerDay: true } }).then((d) => d?.maxFilesPerDay ?? 0)
        : Promise.resolve(0),
      this.prisma.file.count({ where: { ...fileWhereWithDesk, isRedListed: true } }),
      this.prisma.file.count({ where: { ...fileWhereWithDesk, isRedListed: true, redListedAt: { gte: from, lte: to } } }),
      this.prisma.timeExtensionRequest.count({ where: { file: fileWhere } }),
      this.prisma.timeExtensionRequest.count({ where: { file: fileWhere, createdAt: { gte: from, lte: to } } }),
    ]);

    return {
      totalFilesOnDesk,
      incomingInPeriod: incomingCount,
      outgoingInPeriod: outgoingCount,
      optimumVolume: optimumVolume || undefined,
      redListedFiles: redListedCount,
      redListedInPeriod,
      extensionRequestsTotal: extensionTotal,
      extensionRequestsInPeriod: extensionInPeriod,
      period: params.period,
      from,
      to,
    };
  }

  async getVolumeAverages(params: {
    period: PeriodType;
    deskId?: string;
    departmentId?: string;
    dateFrom?: string;
    dateTo?: string;
    roles: string[];
  }) {
    if (!this.canAccessDeskProfile(params.roles)) throw new ForbiddenException('Access denied');
    const { from, to } = this.getDateRange(params.period, params.dateFrom as any, params.dateTo as any);
    const fileWhere = params.departmentId ? { departmentId: params.departmentId } : {};
    const deskFilter = params.deskId ? { deskId: params.deskId } : {};

    const [filesOnDeskAvg, incomingAvg, outgoingAvg, redListedAvg, extensionAvg] = await Promise.all([
      this.prisma.file.aggregate({
        where: { ...fileWhere, ...deskFilter, status: { in: ['PENDING', 'IN_PROGRESS'] }, updatedAt: { gte: from, lte: to } },
        _count: { id: true },
      }),
      this.prisma.fileMovement.count({ where: { ...deskFilter, arrivalTS: { gte: from, lte: to } } }),
      this.prisma.fileMovement.count({ where: { ...deskFilter, endTS: { not: null, gte: from, lte: to } } }),
      this.prisma.file.count({ where: { ...fileWhere, ...deskFilter, isRedListed: true, redListedAt: { gte: from, lte: to } } }),
      this.prisma.timeExtensionRequest.count({ where: { createdAt: { gte: from, lte: to }, file: fileWhere } }),
    ]);

    const days = Math.max(1, (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    return {
      period: params.period,
      from,
      to,
      averageFilesOnDesk: filesOnDeskAvg._count.id / days,
      averageIncoming: incomingAvg / days,
      averageOutgoing: outgoingAvg / days,
      averageRedListed: redListedAvg / days,
      averageExtensionRequests: extensionAvg / days,
    };
  }

  // ---------- Time ----------
  async getOptimumTimePerFile(roles: string[]) {
    if (!roles.includes(UserRole.DEVELOPER) && !roles.includes(UserRole.SUPER_ADMIN)) throw new ForbiddenException('Super Admin or Developer only');
    const config = await this.prisma.performanceConfig.findUnique({
      where: { key: 'desk_profile_optimum_time_per_file_seconds' },
    });
    const seconds = config?.value ? (config.value as number) : null;
    return { optimumTimePerFileSeconds: seconds };
  }

  async setOptimumTimePerFile(seconds: number, roles: string[]) {
    if (!roles.includes(UserRole.DEVELOPER) && !roles.includes(UserRole.SUPER_ADMIN)) throw new ForbiddenException('Super Admin or Developer only');
    await this.prisma.performanceConfig.upsert({
      where: { key: 'desk_profile_optimum_time_per_file_seconds' },
      create: { key: 'desk_profile_optimum_time_per_file_seconds', value: seconds, description: 'Optimum time to process one file (seconds)' },
      update: { value: seconds },
    });
    return { optimumTimePerFileSeconds: seconds };
  }

  async getTimeStats(params: { fileId?: string; deskId?: string; period: PeriodType; roles: string[] }) {
    if (!this.canAccessDeskProfile(params.roles)) throw new ForbiddenException('Access denied');
    const optimumConfig = await this.prisma.performanceConfig.findUnique({
      where: { key: 'desk_profile_optimum_time_per_file_seconds' },
    });
    const optimumSeconds = (optimumConfig?.value as number) ?? 0;

    if (params.fileId) {
      const movements = await this.prisma.fileMovement.findMany({
        where: { fileId: params.fileId },
        orderBy: { arrivalTS: 'asc' },
      });
      const actualTimes = movements
        .filter((m) => m.startTS && m.endTS)
        .map((m) => (new Date(m.endTS!).getTime() - new Date(m.startTS!).getTime()) / 1000);
      return {
        optimumTimePerFileSeconds: optimumSeconds,
        actualTimePerFileSeconds: actualTimes.length ? actualTimes[actualTimes.length - 1] : null,
        allActualTimesSeconds: actualTimes,
      };
    }

    const { from, to } = this.getDateRange(params.period);
    const where: any = { endTS: { not: null, gte: from, lte: to } };
    if (params.deskId) where.deskId = params.deskId;

    const completed = await this.prisma.fileMovement.findMany({
      where,
      select: { startTS: true, endTS: true },
    });
    const times = completed
      .filter((m) => m.startTS && m.endTS)
      .map((m) => (new Date(m.endTS!).getTime() - new Date(m.startTS!).getTime()) / 1000);
    const avgTime = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const optimumVolume = params.deskId
      ? (await this.prisma.desk.findUnique({ where: { id: params.deskId }, select: { maxFilesPerDay: true } }))?.maxFilesPerDay ?? 0
      : 0;

    return {
      optimumTimePerFileSeconds: optimumSeconds,
      averageTimePerFileSeconds: avgTime,
      timeToProcessOptimumVolumeSeconds: optimumSeconds && optimumVolume ? optimumSeconds * optimumVolume : null,
      period: params.period,
    };
  }

  // ---------- File generation (originated from desk) ----------
  async getFilesOriginatedFromDesk(params: { deskId: string; period?: PeriodType; roles: string[] }) {
    if (!this.canAccessDeskProfile(params.roles)) throw new ForbiddenException('Access denied');
    const where: any = { originDeskId: params.deskId };
    if (params.period) {
      const { from, to } = this.getDateRange(params.period);
      where.createdAt = { gte: from, lte: to };
    }
    const count = await this.prisma.file.count({ where });
    return { deskId: params.deskId, filesOriginated: count, period: params.period };
  }

  // ---------- Login ----------
  async getLoginStatus(userId: string, roles: string[]) {
    if (!this.canAccessDeskProfile(roles)) throw new ForbiddenException('Access denied');
    const presence = await this.prisma.presence.findUnique({ where: { userId } });
    const status = presence?.status ?? 'ABSENT';
    return {
      userId,
      status: status === 'ACTIVE' ? 'Active' : status === 'IDLE' ? 'Idle' : status === 'SESSION_TIMEOUT' ? 'Logged Out' : 'Logged Out',
      loginTime: presence?.loginTime ?? null,
    };
  }

  async getLoginTimeToday(userId: string, roles: string[]) {
    if (!this.canAccessDeskProfile(roles)) throw new ForbiddenException('Access denied');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sessions = await this.prisma.loginSession.findMany({
      where: {
        userId,
        loginAt: { gte: todayStart },
      },
    });
    let totalSeconds = sessions.reduce((s, r) => s + (r.durationSeconds ?? 0), 0);
    const presence = await this.prisma.presence.findUnique({ where: { userId } });
    if (presence?.loginTime && presence.status === 'ACTIVE') {
      totalSeconds += (Date.now() - presence.loginTime.getTime()) / 1000;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return { userId, totalSeconds, hours, minutes };
  }

  async getLoginTimeForPeriod(params: { userId: string; period: PeriodType; dateFrom?: string; dateTo?: string; roles: string[] }) {
    if (!this.canAccessDeskProfile(params.roles)) throw new ForbiddenException('Access denied');
    const { from, to } = this.getDateRange(params.period, params.dateFrom as any, params.dateTo as any);
    const sessions = await this.prisma.loginSession.findMany({
      where: { userId: params.userId, loginAt: { gte: from, lte: to } },
    });
    let totalSeconds = sessions.reduce((s, r) => s + (r.durationSeconds ?? 0), 0);
    const presence = await this.prisma.presence.findUnique({ where: { userId: params.userId } });
    if (presence?.loginTime && presence.loginTime >= from && presence.status === 'ACTIVE') {
      totalSeconds += (Date.now() - presence.loginTime.getTime()) / 1000;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return { userId: params.userId, period: params.period, totalSeconds, hours, minutes, from, to };
  }

  // ---------- Config (login reset, idle) ----------
  async getDeskProfileConfig(roles: string[]) {
    if (!roles.includes(UserRole.DEVELOPER) && !roles.includes(UserRole.SUPER_ADMIN) && !roles.includes(UserRole.DEPT_ADMIN)) throw new ForbiddenException('Access denied');
    const keys = [
      'desk_profile_optimum_time_per_file_seconds',
      'desk_profile_login_reset_type',
      'desk_profile_office_hours_start',
      'desk_profile_office_hours_end',
      'desk_profile_idle_reset_minutes',
    ];
    const configs = await this.prisma.performanceConfig.findMany({ where: { key: { in: keys } } });
    const map: Record<string, any> = {};
    configs.forEach((c) => (map[c.key] = c.value));
    return {
      optimumTimePerFileSeconds: map.desk_profile_optimum_time_per_file_seconds ?? null,
      loginResetType: map.desk_profile_login_reset_type ?? 'daily',
      officeHoursStart: map.desk_profile_office_hours_start ?? '09:00',
      officeHoursEnd: map.desk_profile_office_hours_end ?? '17:00',
      idleResetMinutes: map.desk_profile_idle_reset_minutes ?? 30,
    };
  }

  async setDeskProfileConfig(
    data: {
      loginResetType?: 'daily' | 'office_hours';
      officeHoursStart?: string;
      officeHoursEnd?: string;
      idleResetMinutes?: number;
    },
    roles: string[],
  ) {
    if (!roles.includes(UserRole.DEVELOPER) && !roles.includes(UserRole.SUPER_ADMIN)) throw new ForbiddenException('Super Admin or Developer only');
    const updates = [
      data.loginResetType != null && { key: 'desk_profile_login_reset_type', value: data.loginResetType },
      data.officeHoursStart != null && { key: 'desk_profile_office_hours_start', value: data.officeHoursStart },
      data.officeHoursEnd != null && { key: 'desk_profile_office_hours_end', value: data.officeHoursEnd },
      data.idleResetMinutes != null && { key: 'desk_profile_idle_reset_minutes', value: data.idleResetMinutes },
    ].filter(Boolean) as { key: string; value: any }[];
    for (const u of updates) {
      await this.prisma.performanceConfig.upsert({
        where: { key: u.key },
        create: { key: u.key, value: u.value },
        update: { value: u.value },
      });
    }
    return this.getDeskProfileConfig(roles);
  }
}
