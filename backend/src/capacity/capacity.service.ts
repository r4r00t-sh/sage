import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserCapacity {
  userId: string;
  userName: string;
  maxFilesPerDay: number;
  currentFileCount: number;
  utilizationPercent: number;
}

export interface DivisionCapacity {
  divisionId: string;
  divisionName: string;
  calculatedCapacity: number; // Sum of all user capacities
  currentFileCount: number;
  utilizationPercent: number;
  users: UserCapacity[];
}

export interface DepartmentCapacity {
  departmentId: string;
  departmentName: string;
  calculatedCapacity: number; // Sum of all division capacities
  currentFileCount: number;
  utilizationPercent: number;
  divisions: DivisionCapacity[];
}

@Injectable()
export class CapacityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user capacity (files per day)
   */
  async getUserCapacity(userId: string): Promise<UserCapacity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        maxFilesPerDay: true,
        filesAssigned: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            isInQueue: false,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const maxFiles = user.maxFilesPerDay || 10; // Default 10
    const currentCount = user.filesAssigned.length;
    const utilization = maxFiles > 0 ? (currentCount / maxFiles) * 100 : 0;

    return {
      userId: user.id,
      userName: user.name,
      maxFilesPerDay: maxFiles,
      currentFileCount: currentCount,
      utilizationPercent: Math.round(utilization * 100) / 100,
    };
  }

  /**
   * Calculate division capacity from sum of user capacities
   */
  async getDivisionCapacity(divisionId: string): Promise<DivisionCapacity> {
    const division = await this.prisma.division.findUnique({
      where: { id: divisionId },
      include: {
        users: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            maxFilesPerDay: true,
            filesAssigned: {
              where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                isInQueue: false,
              },
            },
          },
        },
        files: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        },
      },
    });

    if (!division) {
      throw new NotFoundException('Division not found');
    }

    // Calculate capacity from users
    const userCapacities: UserCapacity[] = division.users.map((user) => {
      const maxFiles = user.maxFilesPerDay || 10;
      const currentCount = user.filesAssigned.length;
      const utilization = maxFiles > 0 ? (currentCount / maxFiles) * 100 : 0;

      return {
        userId: user.id,
        userName: user.name,
        maxFilesPerDay: maxFiles,
        currentFileCount: currentCount,
        utilizationPercent: Math.round(utilization * 100) / 100,
      };
    });

    const calculatedCapacity = userCapacities.reduce(
      (sum, user) => sum + user.maxFilesPerDay,
      0,
    );
    const currentFileCount = division.files.length;
    const utilization =
      calculatedCapacity > 0
        ? (currentFileCount / calculatedCapacity) * 100
        : 0;

    return {
      divisionId: division.id,
      divisionName: division.name,
      calculatedCapacity,
      currentFileCount,
      utilizationPercent: Math.round(utilization * 100) / 100,
      users: userCapacities,
    };
  }

  /**
   * Calculate department capacity from sum of division capacities
   */
  async getDepartmentCapacity(
    departmentId: string,
  ): Promise<DepartmentCapacity> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        divisions: {
          include: {
            users: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                maxFilesPerDay: true,
                filesAssigned: {
                  where: {
                    status: { in: ['PENDING', 'IN_PROGRESS'] },
                    isInQueue: false,
                  },
                },
              },
            },
            files: {
              where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
              },
            },
          },
        },
        files: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Calculate capacity for each division
    const divisionCapacities: DivisionCapacity[] = department.divisions.map(
      (division) => {
        const userCapacities: UserCapacity[] = division.users.map((user) => {
          const maxFiles = user.maxFilesPerDay || 10;
          const currentCount = user.filesAssigned.length;
          const utilization = maxFiles > 0 ? (currentCount / maxFiles) * 100 : 0;

          return {
            userId: user.id,
            userName: user.name,
            maxFilesPerDay: maxFiles,
            currentFileCount: currentCount,
            utilizationPercent: Math.round(utilization * 100) / 100,
          };
        });

        const divCapacity = userCapacities.reduce(
          (sum, user) => sum + user.maxFilesPerDay,
          0,
        );
        const divCurrentCount = division.files.length;
        const divUtilization =
          divCapacity > 0 ? (divCurrentCount / divCapacity) * 100 : 0;

        return {
          divisionId: division.id,
          divisionName: division.name,
          calculatedCapacity: divCapacity,
          currentFileCount: divCurrentCount,
          utilizationPercent: Math.round(divUtilization * 100) / 100,
          users: userCapacities,
        };
      },
    );

    // Department capacity = sum of all division capacities
    const calculatedCapacity = divisionCapacities.reduce(
      (sum, div) => sum + div.calculatedCapacity,
      0,
    );
    const currentFileCount = department.files.length;
    const utilization =
      calculatedCapacity > 0
        ? (currentFileCount / calculatedCapacity) * 100
        : 0;

    return {
      departmentId: department.id,
      departmentName: department.name,
      calculatedCapacity,
      currentFileCount,
      utilizationPercent: Math.round(utilization * 100) / 100,
      divisions: divisionCapacities,
    };
  }

  /**
   * Set user capacity (admin only)
   */
  async setUserCapacity(
    userId: string,
    maxFilesPerDay: number,
    userRoles: string[],
  ): Promise<UserCapacity> {
    // Only admins can set capacity
    if (
      !userRoles.includes('DEVELOPER') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEPT_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only administrators can set user capacity',
      );
    }

    if (maxFilesPerDay < 1) {
      throw new ForbiddenException('Capacity must be at least 1');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { maxFilesPerDay },
      select: {
        id: true,
        name: true,
        maxFilesPerDay: true,
        filesAssigned: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            isInQueue: false,
          },
        },
      },
    });

      const currentCount = user.filesAssigned.length;
      const maxFiles = user.maxFilesPerDay || 10;
      const utilization = maxFiles > 0 ? (currentCount / maxFiles) * 100 : 0;

    return {
      userId: user.id,
      userName: user.name,
      maxFilesPerDay: user.maxFilesPerDay || 10,
      currentFileCount: currentCount,
      utilizationPercent: Math.round(utilization * 100) / 100,
    };
  }

  /**
   * Get all capacities for a department (hierarchical view)
   */
  async getDepartmentCapacityHierarchy(
    departmentId: string,
  ): Promise<DepartmentCapacity> {
    return this.getDepartmentCapacity(departmentId);
  }

  /**
   * Bulk update user capacities
   */
  async bulkUpdateUserCapacities(
    updates: Array<{ userId: string; maxFilesPerDay: number }>,
    userRoles: string[],
  ): Promise<UserCapacity[]> {
    // Only admins can bulk update
    if (
      !userRoles.includes('DEVELOPER') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEPT_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only administrators can update user capacities',
      );
    }

    const results = await Promise.all(
      updates.map((update) =>
        this.prisma.user.update({
          where: { id: update.userId },
          data: { maxFilesPerDay: update.maxFilesPerDay },
          select: {
            id: true,
            name: true,
            maxFilesPerDay: true,
            filesAssigned: {
              where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                isInQueue: false,
              },
            },
          },
        }),
      ),
    );

    return results.map((user) => {
      const currentCount = user.filesAssigned.length;
      const utilization =
        (user.maxFilesPerDay || 10) > 0
          ? (currentCount / (user.maxFilesPerDay || 10)) * 100
          : 0;

      return {
        userId: user.id,
        userName: user.name,
        maxFilesPerDay: user.maxFilesPerDay || 10,
        currentFileCount: currentCount,
        utilizationPercent: Math.round(utilization * 100) / 100,
      };
    });
  }
}

