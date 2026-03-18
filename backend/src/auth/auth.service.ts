import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import * as bcrypt from 'bcrypt';
import { PresenceStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private presence: PresenceService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      throw new BadRequestException('username and password are required');
    }
    
    // Trim username to handle whitespace issues
    const trimmedUsername = username.trim();
    
    const user = await this.prisma.user.findUnique({
      where: { username: trimmedUsername },
      include: {
        department: true,
        division: true,
      },
    });

    if (!user) {
      console.warn(`Login attempt failed: User not found - ${trimmedUsername}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      console.warn(`Login attempt failed: Inactive account - ${trimmedUsername}`);
      throw new UnauthorizedException('Account is inactive. Please contact administrator.');
    }

    // Allow login even if profile is pending Super Admin approval.
    // Frontend will handle redirecting users with incomplete profiles to the
    // profile completion flow based on `profileCompletedAt`.

    if (!user.passwordHash) {
      console.warn(`Login attempt failed: No password hash - ${trimmedUsername}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any) {
    const roles = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : (r as any)?.value ?? String(r)))
      : user.role
        ? [user.role]
        : [];
    const payload = {
      username: user.username,
      sub: user.id,
      roles,
      departmentId: user.departmentId,
    };

    // Update presence to active with login time (non-fatal if table missing)
    try {
      await this.prisma.presence.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          status: PresenceStatus.ACTIVE,
          lastPing: new Date(),
          loginTime: new Date(),
          logoutTime: null,
          logoutType: null,
        },
        update: {
          status: PresenceStatus.ACTIVE,
          lastPing: new Date(),
          loginTime: new Date(),
          logoutTime: null,
          logoutType: null,
        },
      });
    } catch (e) {
      console.warn('Presence upsert failed:', (e as Error)?.message);
    }

    const userWithAvatarAndProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarKey: true, profileCompletedAt: true },
    });

    const profileCompletedAt =
      userWithAvatarAndProfile?.profileCompletedAt instanceof Date
        ? userWithAvatarAndProfile.profileCompletedAt.toISOString()
        : (user.profileCompletedAt?.toISOString?.() ?? null);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        roles,
        departmentId: user.departmentId,
        divisionId: user.divisionId,
        avatarKey: userWithAvatarAndProfile?.avatarKey ?? null,
        mustChangePassword: user.mustChangePassword ?? false,
        profileCompletedAt,
      },
    };
  }

  async logout(userId: string) {
    // Update presence to absent with logout time
    await this.prisma.presence.upsert({
      where: { userId },
      create: {
        userId,
        status: PresenceStatus.ABSENT,
        lastPing: new Date(),
        logoutTime: new Date(),
        logoutType: 'manual',
      },
      update: {
        status: PresenceStatus.ABSENT,
        logoutTime: new Date(),
        logoutType: 'manual',
      },
    });

    return { success: true };
  }

  async register(data: {
    username: string;
    password: string;
    name: string;
    email?: string;
    roles?: string[];
    departmentId?: string;
    divisionId?: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const roles = (data.roles?.length ? data.roles : ['USER']) as any[];

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash: hashedPassword,
        name: data.name,
        roles,
        departmentId: data.departmentId,
        divisionId: data.divisionId,
      },
      include: {
        department: true,
        division: true,
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }
}
