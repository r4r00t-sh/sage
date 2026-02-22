import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import * as bcrypt from 'bcrypt';
import { GamificationService } from '../gamification/gamification.service';
import { PresenceStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private gamification: GamificationService,
    private presence: PresenceService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      throw new BadRequestException('username and password are required');
    }
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        department: true,
        division: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Initialize user points if not exists (non-blocking; login still succeeds if this fails)
    try {
      await this.gamification.initializeUserPoints(user.id);
    } catch (e) {
      // Log but do not fail login (e.g. UserPoints/SystemSettings table missing)
      console.warn('initializeUserPoints failed:', (e as Error)?.message);
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

    const userWithAvatar = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarKey: true },
    });

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
        avatarKey: userWithAvatar?.avatarKey ?? null,
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

    await this.gamification.initializeUserPoints(user.id);

    const { passwordHash, ...result } = user;
    return result;
  }
}
