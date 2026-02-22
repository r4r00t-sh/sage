import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinIOService } from '../minio/minio.service';
import * as bcrypt from 'bcrypt';

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
        roles: true,
        isActive: true,
        avatarKey: true,
        profileApprovalStatus: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
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
    const profileApprovalStatus = data.createdBySuperAdmin ? 'APPROVED' : 'PENDING_APPROVAL';

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
      roles?: string[];
      departmentId?: string;
      divisionId?: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.designation !== undefined && { designation: data.designation }),
        ...(data.staffId !== undefined && { staffId: data.staffId }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.roles && data.roles.length > 0 && { roles: data.roles as any }),
        ...(data.departmentId !== undefined && {
          departmentId: data.departmentId,
        }),
        ...(data.divisionId !== undefined && { divisionId: data.divisionId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
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
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async resetPassword(id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Password reset successfully' };
  }

  async deactivateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
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
