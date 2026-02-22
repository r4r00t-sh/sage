import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CACHE_TTL = 300; // 5 minutes
const CACHE_KEY_DEPARTMENTS = 'departments:list';
const CACHE_KEY_DIVISIONS = (deptId: string) => `departments:${deptId}:divisions`;

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getAllDepartments() {
    const cached = await this.redis.get(CACHE_KEY_DEPARTMENTS);
    if (cached) {
      try {
        return JSON.parse(cached) as Awaited<ReturnType<typeof this.fetchAllDepartments>>;
      } catch {
        await this.redis.del(CACHE_KEY_DEPARTMENTS);
      }
    }
    const data = await this.fetchAllDepartments();
    await this.redis.set(CACHE_KEY_DEPARTMENTS, JSON.stringify(data), CACHE_TTL);
    return data;
  }

  private async fetchAllDepartments() {
    return this.prisma.department.findMany({
      include: {
        organisation: { select: { id: true, name: true } },
        divisions: { select: { id: true, name: true } },
        _count: { select: { users: true, files: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDepartmentById(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        organisation: true,
        divisions: {
          include: {
            _count: { select: { users: true } },
          },
        },
        users: {
          select: { id: true, name: true, username: true, roles: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async createDepartment(data: {
    name: string;
    code: string;
    organisationId: string;
  }) {
    const dept = await this.prisma.department.create({
      data: {
        name: data.name,
        code: data.code,
        organisationId: data.organisationId,
      },
    });
    await this.redis.del(CACHE_KEY_DEPARTMENTS);
    return dept;
  }

  async updateDepartment(id: string, data: { name?: string; code?: string }) {
    const dept = await this.prisma.department.update({
      where: { id },
      data,
    });
    await this.redis.del(CACHE_KEY_DEPARTMENTS);
    await this.redis.del(CACHE_KEY_DIVISIONS(id));
    return dept;
  }

  async deleteDepartment(id: string) {
    const dept = await this.prisma.department.delete({
      where: { id },
    });
    await this.redis.del(CACHE_KEY_DEPARTMENTS);
    await this.redis.del(CACHE_KEY_DIVISIONS(id));
    return dept;
  }

  async getInwardDeskDepartments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    if (!user?.departmentId) {
      return [];
    }

    return this.prisma.department.findMany({
      where: { id: user.departmentId },
      include: {
        divisions: true,
      },
    });
  }

  async getDivisions(departmentId: string) {
    const key = CACHE_KEY_DIVISIONS(departmentId);
    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as Awaited<ReturnType<typeof this.fetchDivisions>>;
      } catch {
        await this.redis.del(key);
      }
    }
    const data = await this.fetchDivisions(departmentId);
    await this.redis.set(key, JSON.stringify(data), CACHE_TTL);
    return data;
  }

  private async fetchDivisions(departmentId: string) {
    return this.prisma.division.findMany({
      where: { departmentId },
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDivision(departmentId: string, name: string) {
    const code = name.toUpperCase().replace(/\s+/g, '-').substring(0, 10);
    const division = await this.prisma.division.create({
      data: {
        name,
        code,
        departmentId,
      },
    });
    await this.redis.del(CACHE_KEY_DEPARTMENTS);
    await this.redis.del(CACHE_KEY_DIVISIONS(departmentId));
    return division;
  }

  async getDivisionUsers(divisionId: string) {
    return this.prisma.user.findMany({
      where: {
        divisionId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        roles: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
