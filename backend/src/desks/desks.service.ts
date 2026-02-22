import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DesksService {
  constructor(private prisma: PrismaService) {}

  // Create a new desk
  async createDesk(
    userId: string,
    userRoles: string[],
    data: {
      name: string;
      code: string;
      description?: string;
      departmentId: string;
      divisionId?: string;
      maxFilesPerDay?: number;
      iconType?: string;
    },
  ) {
    // Only admins can create desks
    if (!userRoles.includes(UserRole.SUPER_ADMIN) && !userRoles.includes(UserRole.DEPT_ADMIN)) {
      throw new ForbiddenException('Only administrators can create desks');
    }

    // Check if code already exists
    const existing = await this.prisma.desk.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ForbiddenException('Desk code already exists');
    }

    return this.prisma.desk.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        departmentId: data.departmentId,
        divisionId: data.divisionId,
        maxFilesPerDay: data.maxFilesPerDay || 10,
        iconType: data.iconType || 'desk',
        isActive: true,
        isAutoCreated: false,
      },
    });
  }

  // Get all desks for a department
  async getDesks(departmentId?: string, divisionId?: string) {
    const where: any = { isActive: true };

    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (divisionId) {
      where.divisionId = divisionId;
    }

    const desks = await this.prisma.desk.findMany({
      where,
      include: {
        department: { select: { name: true, code: true } },
        division: { select: { name: true } },
        _count: {
          select: { files: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate capacity utilization for each desk
    return desks.map((desk) => {
      const currentCount = desk._count.files;
      const utilization =
        desk.maxFilesPerDay > 0
          ? (currentCount / desk.maxFilesPerDay) * 100
          : 0;

      // Calculate estimated processing time
      // If desk is at capacity, estimate based on files per day
      // Otherwise, estimate based on current queue
      const estimatedDays =
        currentCount > 0 ? Math.ceil(currentCount / desk.maxFilesPerDay) : 0;
      const estimatedHours = estimatedDays * 8; // Assuming 8 working hours per day

      return {
        ...desk,
        currentFileCount: currentCount,
        capacityUtilizationPercent: Math.round(utilization * 100) / 100,
        optimumCapacity: desk.maxFilesPerDay,
        estimatedProcessingTimeDays: estimatedDays,
        estimatedProcessingTimeHours: estimatedHours,
      };
    });
  }

  // Get desk by ID
  async getDeskById(deskId: string) {
    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      include: {
        department: { select: { name: true, code: true } },
        division: { select: { name: true } },
        files: {
          include: {
            assignedTo: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!desk) {
      throw new NotFoundException('Desk not found');
    }

    const utilization =
      desk.maxFilesPerDay > 0
        ? (desk.files.length / desk.maxFilesPerDay) * 100
        : 0;

    return {
      ...desk,
      currentFileCount: desk.files.length,
      capacityUtilizationPercent: Math.round(utilization * 100) / 100,
    };
  }

  // Assign file to desk
  async assignFileToDesk(
    fileId: string,
    deskId: string,
    userId: string,
    userRoles: string[],
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
    });

    if (!desk) {
      throw new NotFoundException('Desk not found');
    }

    // Check authorization - only admins or assigned user can assign
    if (
      !userRoles.includes(UserRole.SUPER_ADMIN) &&
      !userRoles.includes(UserRole.DEPT_ADMIN) &&
      file.assignedToId !== userId
    ) {
      throw new ForbiddenException(
        'You are not authorized to assign files to desks',
      );
    }

    // Check capacity
    const currentCount = await this.prisma.file.count({
      where: { deskId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });

    if (currentCount >= desk.maxFilesPerDay) {
      throw new ForbiddenException(
        'Desk capacity reached. Please select another desk or create a new one.',
      );
    }

    // Assign file; set desk of origin on first assignment
    return this.prisma.file.update({
      where: { id: fileId },
      data: {
        deskId,
        ...(file.originDeskId == null && { originDeskId: deskId }),
      },
    });
  }

  // Calculate and update desk capacity
  // If desk has a division, use division capacity; otherwise use desk's own capacity
  async updateDeskCapacity(deskId: string) {
    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      include: {
        division: {
          include: {
            users: {
              where: { isActive: true },
              select: { maxFilesPerDay: true },
            },
          },
        },
      },
    });

    if (!desk) {
      throw new NotFoundException('Desk not found');
    }

    const currentCount = await this.prisma.file.count({
      where: {
        deskId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // Calculate capacity: if desk has division, use division capacity (sum of user capacities)
    // Otherwise, use desk's own maxFilesPerDay
    let calculatedCapacity = desk.maxFilesPerDay;
    if (desk.divisionId && desk.division) {
      // Division capacity = sum of all user capacities in that division
      calculatedCapacity = desk.division.users.reduce(
        (sum, user) => sum + (user.maxFilesPerDay || 10),
        desk.maxFilesPerDay, // Fallback to desk capacity if no users
      );
    }

    const utilization =
      calculatedCapacity > 0 ? (currentCount / calculatedCapacity) * 100 : 0;

    return this.prisma.desk.update({
      where: { id: deskId },
      data: {
        currentFileCount: currentCount,
        capacityUtilizationPercent: utilization,
        optimumCapacity: calculatedCapacity,
      },
    });
  }

  // Auto-create new desk when capacity reached
  async autoCreateDesk(departmentId: string, divisionId?: string) {
    // Find existing desks to determine next number
    const existingDesks = await this.prisma.desk.findMany({
      where: {
        departmentId,
        divisionId: divisionId || null,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const nextNumber = existingDesks.length + 1;
    const deskCode = divisionId
      ? `DESK-${departmentId.substring(0, 3).toUpperCase()}-${nextNumber}`
      : `DESK-${departmentId.substring(0, 3).toUpperCase()}-${nextNumber}`;

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { code: true },
    });

    return this.prisma.desk.create({
      data: {
        name: `Desk ${nextNumber}`,
        code: `${department?.code || 'DEPT'}-DESK-${nextNumber}`,
        description: 'Auto-created when capacity reached',
        departmentId,
        divisionId,
        maxFilesPerDay: 10, // Default
        isActive: true,
        isAutoCreated: true,
      },
    });
  }

  // Check if desk capacity reached and auto-create if needed
  async checkAndAutoCreateDesk(departmentId: string, divisionId?: string) {
    const desks = await this.getDesks(departmentId, divisionId);

    // Find desks at or above capacity
    const fullDesks = desks.filter((d) => d.capacityUtilizationPercent >= 100);

    if (fullDesks.length > 0) {
      // Check if there are any desks with available capacity
      const availableDesks = desks.filter(
        (d) => d.capacityUtilizationPercent < 100,
      );

      // If no available desks, auto-create one
      if (availableDesks.length === 0) {
        return this.autoCreateDesk(departmentId, divisionId);
      }
    }

    return null;
  }

  // Get desk workload and capacity summary
  async getDeskWorkloadSummary(departmentId?: string) {
    const where: any = { isActive: true };
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const desks = await this.prisma.desk.findMany({
      where,
      include: {
        department: { select: { name: true, code: true } },
        division: { select: { name: true } },
        _count: {
          select: {
            files: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            },
          },
        },
      },
    });

    const totalFiles = desks.reduce((sum, d) => sum + d._count.files, 0);
    const totalCapacity = desks.reduce((sum, d) => sum + d.maxFilesPerDay, 0);
    const overallUtilization =
      totalCapacity > 0 ? (totalFiles / totalCapacity) * 100 : 0;

    return {
      totalDesks: desks.length,
      activeDesks: desks.filter((d) => d._count.files > 0).length,
      totalFiles,
      totalCapacity,
      overallUtilization: Math.round(overallUtilization * 100) / 100,
      desks: desks.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        currentFiles: d._count.files,
        maxFiles: d.maxFilesPerDay,
        utilization:
          d.maxFilesPerDay > 0
            ? Math.round((d._count.files / d.maxFilesPerDay) * 100 * 100) / 100
            : 0,
        isFull: d._count.files >= d.maxFilesPerDay,
        department: d.department,
        division: d.division,
      })),
    };
  }

  // Update desk configuration
  async updateDesk(
    deskId: string,
    userId: string,
    userRoles: string[],
    data: {
      name?: string;
      description?: string;
      maxFilesPerDay?: number;
      iconType?: string;
      isActive?: boolean;
    },
  ) {
    if (!userRoles.includes(UserRole.SUPER_ADMIN) && !userRoles.includes(UserRole.DEPT_ADMIN)) {
      throw new ForbiddenException('Only administrators can update desks');
    }

    return this.prisma.desk.update({
      where: { id: deskId },
      data,
    });
  }

  // Delete desk (soft delete)
  async deleteDesk(deskId: string, userId: string, userRoles: string[]) {
    if (!userRoles.includes(UserRole.SUPER_ADMIN) && !userRoles.includes(UserRole.DEPT_ADMIN)) {
      throw new ForbiddenException('Only administrators can delete desks');
    }

    // Check if desk has files
    const fileCount = await this.prisma.file.count({
      where: { deskId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });

    if (fileCount > 0) {
      throw new ForbiddenException(
        'Cannot delete desk with active files. Please reassign files first.',
      );
    }

    return this.prisma.desk.update({
      where: { id: deskId },
      data: { isActive: false },
    });
  }
}
