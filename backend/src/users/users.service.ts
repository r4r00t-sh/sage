import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinIOService } from '../minio/minio.service';
import * as bcrypt from 'bcrypt';

const UI_APPEARANCE_THEMES = ['light', 'dark', 'system'] as const;
const UI_COLOR_THEMES = [
  'neutral',
  'blue',
  'green',
  'orange',
  'red',
  'rose',
  'violet',
  'yellow',
] as const;

function normalizeUiThemePayload(data: {
  uiAppearanceTheme?: string | null;
  uiColorTheme?: string | null;
}): { uiAppearanceTheme?: string | null; uiColorTheme?: string | null } | null {
  const hasApp = data.uiAppearanceTheme !== undefined;
  const hasCol = data.uiColorTheme !== undefined;
  if (!hasApp && !hasCol) return null;

  const out: { uiAppearanceTheme?: string | null; uiColorTheme?: string | null } = {};

  if (hasApp) {
    const v = data.uiAppearanceTheme;
    if (v === null || v === '') {
      out.uiAppearanceTheme = null;
    } else if (
      typeof v === 'string' &&
      (UI_APPEARANCE_THEMES as readonly string[]).includes(v)
    ) {
      out.uiAppearanceTheme = v;
    } else {
      throw new BadRequestException(
        'uiAppearanceTheme must be light, dark, or system',
      );
    }
  }

  if (hasCol) {
    const v = data.uiColorTheme;
    if (v === null || v === '') {
      out.uiColorTheme = null;
    } else if (
      typeof v === 'string' &&
      (UI_COLOR_THEMES as readonly string[]).includes(v)
    ) {
      out.uiColorTheme = v === 'neutral' ? null : v;
    } else {
      throw new BadRequestException('Invalid uiColorTheme');
    }
  }

  return out;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private minio: MinIOService,
  ) {}

  async getAllUsers(filters?: {
    departmentId?: string;
    role?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters?.role) {
      where.roles = { has: filters.role as any };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        designation: true,
        staffId: true,
        phone: true,
        roles: true,
        isActive: true,
        avatarKey: true,
        profileApprovalStatus: true,
        approvedAt: true,
        createdAt: true,
        department: { select: { id: true, name: true, code: true } },
        division: { select: { id: true, name: true } },
        points: { select: { currentPoints: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        designation: true,
        staffId: true,
        phone: true,
        phoneAlternate: true,
        bio: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        nationality: true,
        maritalStatus: true,
        bloodGroup: true,
        personalEmail: true,
        address: true,
        city: true,
        postalCode: true,
        employmentType: true,
        dateOfJoining: true,
        contractEndDate: true,
        reportingOfficial: true,
        workLocation: true,
        officeExtension: true,
        accountStatus: true,
        highestQualification: true,
        fieldOfStudy: true,
        institution: true,
        yearOfGraduation: true,
        skills: true,
        emergencyContactName: true,
        emergencyContactRelationship: true,
        emergencyContactPhone: true,
        emergencyContactPhoneAlt: true,
        emergencyContactEmail: true,
        adminNotes: true,
        mustChangePassword: true,
        profileCompletedAt: true,
        roles: true,
        isActive: true,
        avatarKey: true,
        profileApprovalStatus: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
        uiAppearanceTheme: true,
        uiColorTheme: true,
        department: { select: { id: true, name: true, code: true } },
        division: { select: { id: true, name: true } },
        points: true,
        _count: {
          select: {
            filesCreated: true,
            filesAssigned: true,
            notes: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async uploadAvatar(userId: string, file: { buffer: Buffer; mimetype: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid image type. Use JPEG, PNG, GIF, or WebP.');
    }

    if (file.buffer.length > 2 * 1024 * 1024) {
      throw new BadRequestException('Image must be less than 2MB.');
    }

    const ext = file.mimetype.split('/')[1] || 'jpg';
    const objectName = await this.minio.uploadFile(
      `avatar-${userId}-${Date.now()}.${ext}`,
      file.buffer,
      file.mimetype,
    );

    if (user.avatarKey) {
      try {
        await this.minio.deleteFile(user.avatarKey);
      } catch {
        // Ignore if old file doesn't exist
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: objectName },
    });

    return { avatarKey: objectName };
  }

  async getAvatarUrl(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!user?.avatarKey) return null;
    return this.minio.getFileUrl(user.avatarKey, 3600);
  }

  async getAvatarStream(userId: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!user?.avatarKey) return null;
    const stream = await this.minio.getFileStream(user.avatarKey);
    const ext = user.avatarKey.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/jpeg';
    return { stream, contentType };
  }

  async createUser(data: {
    username: string;
    password: string;
    name: string;
    email?: string;
    designation?: string;
    staffId?: string;
    phone?: string;
    roles: string[];
    departmentId?: string;
    divisionId?: string;
    createdBySuperAdmin?: boolean;
  }) {
    // Check if username already exists
    const existing = await this.prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const roles = (data.roles?.length ? data.roles : ['USER']) as any[];
    // All users are auto-approved; no manual Super Admin approval step required.
    const profileApprovalStatus = 'APPROVED';

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        name: data.name,
        email: data.email,
        designation: data.designation,
        staffId: data.staffId,
        phone: data.phone,
        roles,
        departmentId: data.departmentId,
        divisionId: data.divisionId,
        profileApprovalStatus: profileApprovalStatus as any,
        mustChangePassword: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        designation: true,
        staffId: true,
        phone: true,
        roles: true,
        isActive: true,
        profileApprovalStatus: true,
        department: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
      },
    });

    // Create initial points record
    await this.prisma.userPoints.create({
      data: {
        userId: user.id,
        basePoints: 1000,
        currentPoints: 1000,
      },
    });

    return user;
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      designation?: string;
      staffId?: string;
      phone?: string;
      phoneAlternate?: string;
      bio?: string;
      profileCompletedAt?: boolean;
      roles?: string[];
      departmentId?: string;
      divisionId?: string;
      isActive?: boolean;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      dateOfBirth?: string;
      gender?: string;
      nationality?: string;
      maritalStatus?: string;
      bloodGroup?: string;
      personalEmail?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      employmentType?: string;
      dateOfJoining?: string;
      contractEndDate?: string;
      reportingOfficial?: string;
      workLocation?: string;
      officeExtension?: string;
      accountStatus?: string;
      highestQualification?: string;
      fieldOfStudy?: string;
      institution?: string;
      yearOfGraduation?: number;
      skills?: string | string[];
      emergencyContactName?: string;
      emergencyContactRelationship?: string;
      emergencyContactPhone?: string;
      emergencyContactPhoneAlt?: string;
      emergencyContactEmail?: string;
      adminNotes?: string;
      uiAppearanceTheme?: string | null;
      uiColorTheme?: string | null;
    },
  ) {
    const uiThemes = normalizeUiThemePayload(data);

    const parts = [data.firstName, data.middleName, data.lastName].filter(Boolean) as string[];
    const derivedName = parts.length > 0 ? parts.join(' ') : undefined;
    const skillsStr =
      data.skills !== undefined
        ? Array.isArray(data.skills)
          ? JSON.stringify(data.skills)
          : data.skills
        : undefined;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(derivedName && { name: derivedName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.designation !== undefined && { designation: data.designation }),
        ...(data.staffId !== undefined && { staffId: data.staffId }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.phoneAlternate !== undefined && { phoneAlternate: data.phoneAlternate }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.profileCompletedAt !== undefined && {
          profileCompletedAt: data.profileCompletedAt ? new Date() : null,
        }),
        ...(data.roles && data.roles.length > 0 && { roles: data.roles as any }),
        ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
        ...(data.divisionId !== undefined && { divisionId: data.divisionId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.middleName !== undefined && { middleName: data.middleName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.dateOfBirth !== undefined && {
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.nationality !== undefined && { nationality: data.nationality }),
        ...(data.maritalStatus !== undefined && { maritalStatus: data.maritalStatus }),
        ...(data.bloodGroup !== undefined && { bloodGroup: data.bloodGroup }),
        ...(data.personalEmail !== undefined && { personalEmail: data.personalEmail }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
        ...(data.dateOfJoining !== undefined && {
          dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining) : null,
        }),
        ...(data.contractEndDate !== undefined && {
          contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        }),
        ...(data.reportingOfficial !== undefined && { reportingOfficial: data.reportingOfficial }),
        ...(data.workLocation !== undefined && { workLocation: data.workLocation }),
        ...(data.officeExtension !== undefined && { officeExtension: data.officeExtension }),
        ...(data.accountStatus !== undefined && { accountStatus: data.accountStatus }),
        ...(data.highestQualification !== undefined && { highestQualification: data.highestQualification }),
        ...(data.fieldOfStudy !== undefined && { fieldOfStudy: data.fieldOfStudy }),
        ...(data.institution !== undefined && { institution: data.institution }),
        ...(data.yearOfGraduation !== undefined && { yearOfGraduation: data.yearOfGraduation }),
        ...(skillsStr !== undefined && { skills: skillsStr }),
        ...(data.emergencyContactName !== undefined && { emergencyContactName: data.emergencyContactName }),
        ...(data.emergencyContactRelationship !== undefined && { emergencyContactRelationship: data.emergencyContactRelationship }),
        ...(data.emergencyContactPhone !== undefined && { emergencyContactPhone: data.emergencyContactPhone }),
        ...(data.emergencyContactPhoneAlt !== undefined && { emergencyContactPhoneAlt: data.emergencyContactPhoneAlt }),
        ...(data.emergencyContactEmail !== undefined && { emergencyContactEmail: data.emergencyContactEmail }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
        ...(uiThemes?.uiAppearanceTheme !== undefined && {
          uiAppearanceTheme: uiThemes.uiAppearanceTheme,
        }),
        ...(uiThemes?.uiColorTheme !== undefined && {
          uiColorTheme: uiThemes.uiColorTheme,
        }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        designation: true,
        staffId: true,
        phone: true,
        phoneAlternate: true,
        bio: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        nationality: true,
        maritalStatus: true,
        bloodGroup: true,
        personalEmail: true,
        address: true,
        city: true,
        postalCode: true,
        employmentType: true,
        dateOfJoining: true,
        contractEndDate: true,
        reportingOfficial: true,
        workLocation: true,
        officeExtension: true,
        accountStatus: true,
        highestQualification: true,
        fieldOfStudy: true,
        institution: true,
        yearOfGraduation: true,
        skills: true,
        emergencyContactName: true,
        emergencyContactRelationship: true,
        emergencyContactPhone: true,
        emergencyContactPhoneAlt: true,
        emergencyContactEmail: true,
        adminNotes: true,
        mustChangePassword: true,
        profileCompletedAt: true,
        roles: true,
        isActive: true,
        profileApprovalStatus: true,
        uiAppearanceTheme: true,
        uiColorTheme: true,
        department: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
      },
    });
  }

  async approveProfile(userId: string, approvedById: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        profileApprovalStatus: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        name: true,
        profileApprovalStatus: true,
        approvedAt: true,
      },
    });
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return { message: 'Password changed successfully' };
  }

  async resetPassword(id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async deactivateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard-delete a user row. Reassigns FKs that would block deletion (files created, notes,
   * opinions, etc.) to another active user. Destroys chat/DM data tied with onDelete: Cascade.
   */
  async permanentlyDeleteUser(actorId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, avatarKey: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const fallback = await this.prisma.user.findFirst({
      where: {
        id: { not: targetUserId },
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        departmentId: true,
        divisionId: true,
      },
    });

    if (!fallback) {
      throw new BadRequestException(
        'Cannot delete the only active user account. Create or activate another admin first.',
      );
    }

    if (target.avatarKey) {
      try {
        await this.minio.deleteFile(target.avatarKey);
      } catch {
        /* ignore missing object */
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.file.updateMany({
          where: { createdById: targetUserId },
          data: { createdById: fallback.id },
        });

        await tx.file.updateMany({
          where: { assignedToId: targetUserId },
          data: { assignedToId: null },
        });

        await tx.note.updateMany({
          where: { userId: targetUserId },
          data: { userId: fallback.id },
        });

        await tx.forwardQueue.updateMany({
          where: { fromUserId: targetUserId },
          data: { fromUserId: null },
        });

        const queueRows = await tx.forwardQueue.findMany({
          where: { toUserId: targetUserId },
        });
        for (const row of queueRows) {
          await tx.forwardQueue.update({
            where: { id: row.id },
            data: {
              toUserId: fallback.id,
              toDivisionId: fallback.divisionId ?? row.toDivisionId,
            },
          });
        }

        const assignments = await tx.fileAssignment.findMany({
          where: { toUserId: targetUserId },
        });
        for (const a of assignments) {
          await tx.fileAssignment.update({
            where: { id: a.id },
            data: {
              toUserId: fallback.id,
              toDepartmentId: fallback.departmentId ?? a.toDepartmentId,
              toDivisionId: fallback.divisionId ?? a.toDivisionId,
            },
          });
        }

        await tx.opinionRequest.updateMany({
          where: { requestedById: targetUserId },
          data: { requestedById: fallback.id },
        });

        await tx.opinionRequest.updateMany({
          where: { respondedById: targetUserId },
          data: { respondedById: null },
        });

        await tx.opinionRequest.updateMany({
          where: { requestedToUserId: targetUserId },
          data: { requestedToUserId: null },
        });

        await tx.opinionNote.updateMany({
          where: { addedById: targetUserId },
          data: { addedById: fallback.id },
        });

        await tx.dispatchProof.updateMany({
          where: { dispatchedById: targetUserId },
          data: { dispatchedById: fallback.id },
        });

        await tx.fileBackFileLink.updateMany({
          where: { linkedById: targetUserId },
          data: { linkedById: fallback.id },
        });

        await tx.workflow.updateMany({
          where: { createdById: targetUserId },
          data: { createdById: fallback.id },
        });

        await tx.workflow.updateMany({
          where: { publishedById: targetUserId },
          data: { publishedById: null },
        });

        await tx.user.updateMany({
          where: { approvedById: targetUserId },
          data: { approvedById: null },
        });

        await tx.notification.deleteMany({
          where: { userId: targetUserId },
        });

        await tx.loginSession.deleteMany({
          where: { userId: targetUserId },
        });

        await tx.pointsTransaction.deleteMany({
          where: { userId: targetUserId },
        });

        await tx.user.delete({ where: { id: targetUserId } });
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code: string }).code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot delete user: some records still reference this account. Contact support with this error.',
        );
      }
      throw e;
    }

    return {
      message:
        'User deleted permanently. Files and notes they created are attributed to a fallback account.',
    };
  }

  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        points: true,
        _count: { select: { filesCreated: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [filesProcessed, achievements, recentLogs] = await Promise.all([
      this.prisma.file.count({
        where: { assignedToId: userId, status: 'APPROVED' },
      }),
      this.prisma.performanceBadge.findMany({
        where: { userId },
        orderBy: { awardedAt: 'desc' },
        take: 20,
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          file: { select: { fileNumber: true, subject: true } },
        },
      }),
    ]);

    const achievementsFormatted = achievements.map((a) => ({
      id: a.id,
      name: a.badgeName,
      description: a.description || a.badgeType,
      icon: a.badgeType,
      earnedAt: a.awardedAt.toISOString(),
    }));

    const recentActivity = recentLogs.map((log) => ({
      id: log.id,
      type: log.entityType,
      description:
        log.entityType === 'File' && log.file
          ? `${log.action}: ${log.file.fileNumber} - ${log.file.subject}`
          : `${log.action} (${log.entityType})`,
      timestamp: log.createdAt.toISOString(),
    }));

    return {
      filesCreated: user._count.filesCreated,
      filesProcessed,
      filesApproved: filesProcessed,
      totalPoints: user.points?.currentPoints ?? 1000,
      currentStreak: user.points?.streakMonths ?? 0,
      achievements: achievementsFormatted,
      recentActivity,
    };
  }

  async getAuditLogs(userId: string, limit = 50) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.auditLog.findMany({
      where: { userId },
      include: {
        file: { select: { id: true, fileNumber: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getActivity(userId: string, limit = 50) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const routing = await this.prisma.fileRouting.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        file: {
          select: { id: true, fileNumber: true, subject: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return routing;
  }

  async getPresence(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const presence = await this.prisma.presence.findUnique({
      where: { userId },
    });

    const HEARTBEAT_TIMEOUT = 3 * 60 * 1000;
    let status = 'ABSENT';
    let statusLabel = 'Offline';

    if (presence) {
      const timeSincePing = Date.now() - presence.lastPing.getTime();
      if (timeSincePing <= HEARTBEAT_TIMEOUT) {
        status = presence.status;
        statusLabel =
          presence.status === 'ACTIVE'
            ? 'Active'
            : presence.status === 'SESSION_TIMEOUT'
              ? 'Session Expired'
              : 'Offline';
      }
    }

    return {
      status,
      statusLabel,
      lastPing: presence?.lastPing,
      loginTime: presence?.loginTime,
      logoutTime: presence?.logoutTime,
      logoutType: presence?.logoutType,
    };
  }
}
