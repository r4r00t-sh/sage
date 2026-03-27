import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { TimingService } from '../timing/timing.service';

@Injectable()
export class DesksService {
  constructor(
    private prisma: PrismaService,
    private timing: TimingService,
  ) {}

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
      slaNorm?: number; // SLA norm in hours
    },
  ) {
    // Tech Panel only
    if (!userRoles.includes(UserRole.DEVELOPER)) {
      throw new ForbiddenException('Only Tech Panel can create desks');
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
        slaNorm: data.slaNorm || null, // SLA norm in hours (optional)
        isActive: true,
        isAutoCreated: false,
      },
    });
  }

  // Get all desks for a department
  // In this system, "desk" means: Departments, Divisions, Users, and actual Desk entities
  async getDesks(departmentId?: string, divisionId?: string) {
    const allDesks: any[] = [];

    // 1. Get all Departments as desks
    const deptWhere: any = {};
    if (departmentId) {
      deptWhere.id = departmentId;
    }
    const departments = await this.prisma.department.findMany({
      where: deptWhere,
      include: {
        _count: {
          select: {
            files: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            },
          },
        },
      },
    });

    for (const dept of departments) {
      const currentCount = dept._count.files;
      allDesks.push({
        id: `dept-${dept.id}`,
        name: dept.name,
        code: dept.code,
        description: `Department: ${dept.name}`,
        type: 'department',
        department: { name: dept.name, code: dept.code },
        division: null,
        maxFilesPerDay: 50, // Default capacity for departments
        currentFileCount: currentCount,
        capacityUtilizationPercent: Math.round((currentCount / 50) * 100 * 100) / 100,
        optimumCapacity: 50,
        isActive: true,
        isAutoCreated: false,
        iconType: 'building',
        estimatedProcessingTimeDays: currentCount > 0 ? Math.ceil(currentCount / 50) : 0,
        estimatedProcessingTimeHours: currentCount > 0 ? Math.ceil(currentCount / 50) * 8 : 0,
      });
    }

    // 2. Get all Divisions as desks
    const divWhere: any = {};
    if (departmentId) {
      divWhere.departmentId = departmentId;
    }
    if (divisionId) {
      divWhere.id = divisionId;
    }
    const divisions = await this.prisma.division.findMany({
      where: divWhere,
      include: {
        department: { select: { name: true, code: true } },
        _count: {
          select: {
            files: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            },
          },
        },
      },
    });

    for (const div of divisions) {
      const currentCount = div._count.files;
      allDesks.push({
        id: `div-${div.id}`,
        name: div.name,
        code: div.code,
        description: `Division: ${div.name}`,
        type: 'division',
        department: div.department,
        division: { name: div.name },
        maxFilesPerDay: 30, // Default capacity for divisions
        currentFileCount: currentCount,
        capacityUtilizationPercent: Math.round((currentCount / 30) * 100 * 100) / 100,
        optimumCapacity: 30,
        isActive: true,
        isAutoCreated: false,
        iconType: 'folder',
        estimatedProcessingTimeDays: currentCount > 0 ? Math.ceil(currentCount / 30) : 0,
        estimatedProcessingTimeHours: currentCount > 0 ? Math.ceil(currentCount / 30) * 8 : 0,
      });
    }

    // 3. Get all Users as desks
    const userWhere: any = { isActive: true };
    if (departmentId) {
      userWhere.departmentId = departmentId;
    }
    if (divisionId) {
      userWhere.divisionId = divisionId;
    }
    const users = await this.prisma.user.findMany({
      where: userWhere,
      include: {
        department: { select: { name: true, code: true } },
        division: { select: { name: true } },
        _count: {
          select: {
            filesAssigned: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            },
          },
        },
      },
    });

    for (const user of users) {
      const currentCount = user._count.filesAssigned;
      const maxFiles = user.maxFilesPerDay || 10;
      allDesks.push({
        id: `user-${user.id}`,
        name: user.name,
        code: user.username,
        description: `User: ${user.name} (${user.username})`,
        type: 'user',
        department: user.department ? { name: user.department.name, code: user.department.code } : null,
        division: user.division ? { name: user.division.name } : null,
        maxFilesPerDay: maxFiles,
        currentFileCount: currentCount,
        capacityUtilizationPercent: Math.round((currentCount / maxFiles) * 100 * 100) / 100,
        optimumCapacity: maxFiles,
        isActive: user.isActive,
        isAutoCreated: false,
        iconType: 'user',
        estimatedProcessingTimeDays: currentCount > 0 ? Math.ceil(currentCount / maxFiles) : 0,
        estimatedProcessingTimeHours: currentCount > 0 ? Math.ceil(currentCount / maxFiles) * 8 : 0,
      });
    }

    // 4. Get actual Desk entities
    const deskWhere: any = { isActive: true };
    if (departmentId) {
      deskWhere.departmentId = departmentId;
    }
    if (divisionId) {
      deskWhere.divisionId = divisionId;
    }

    const physicalDesks = await this.prisma.desk.findMany({
      where: deskWhere,
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
      orderBy: { createdAt: 'asc' },
    });

    for (const desk of physicalDesks) {
      const currentCount = desk._count.files;
      const utilization =
        desk.maxFilesPerDay > 0
          ? (currentCount / desk.maxFilesPerDay) * 100
          : 0;
      const estimatedDays =
        currentCount > 0 ? Math.ceil(currentCount / desk.maxFilesPerDay) : 0;

      allDesks.push({
        id: desk.id,
        name: desk.name,
        code: desk.code,
        description: desk.description,
        type: 'desk',
        department: desk.department,
        division: desk.division,
        maxFilesPerDay: desk.maxFilesPerDay,
        currentFileCount: currentCount,
        capacityUtilizationPercent: Math.round(utilization * 100) / 100,
        optimumCapacity: desk.maxFilesPerDay,
        isActive: desk.isActive,
        isAutoCreated: desk.isAutoCreated,
        iconType: desk.iconType || 'desk',
        estimatedProcessingTimeDays: estimatedDays,
        estimatedProcessingTimeHours: estimatedDays * 8,
      });
    }

    // Sort by name for consistent ordering
    return allDesks.sort((a, b) => a.name.localeCompare(b.name));
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

    // Get desk SLA norm to calculate allotted time (or use default 48h from system settings)
    const deskWithSla = await this.prisma.desk.findUnique({
      where: { id: deskId },
      select: { slaNorm: true },
    });
    const defaultSetting = await this.prisma.systemSettings
      .findFirst({
        where: {
          key: 'defaultSlaNormHours',
          OR: [
            ...(file.departmentId ? [{ departmentId: file.departmentId }] : []),
            { departmentId: null },
          ],
        },
        orderBy: { departmentId: 'desc' },
        select: { value: true },
      })
      .catch(() => null);
    const defaultSlaHours = defaultSetting ? parseInt(defaultSetting.value, 10) : 48;
    const slaHours = deskWithSla?.slaNorm ?? (Number.isNaN(defaultSlaHours) ? 48 : defaultSlaHours);

    const now = new Date();
    const allottedTimeInSeconds = slaHours * 3600; // Convert hours to seconds
    const deskDueDate = new Date(now.getTime() + allottedTimeInSeconds * 1000);

    // Assign file; set desk of origin on first assignment, and set timing fields
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        deskId,
        ...(file.originDeskId == null && { originDeskId: deskId }),
        deskArrivalTime: now,
        allottedTime: allottedTimeInSeconds,
        deskDueDate: deskDueDate,
      },
    });

    await this.timing.updateTimeRemaining(fileId);

    return updatedFile;
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
  // Counts all desks: Departments, Divisions, Users, and actual Desk entities
  async getDeskWorkloadSummary(departmentId?: string) {
    // Get all desks using the same method
    const allDesks = await this.getDesks(departmentId);

    const totalFiles = allDesks.reduce((sum, d) => sum + d.currentFileCount, 0);
    const totalCapacity = allDesks.reduce((sum, d) => sum + d.maxFilesPerDay, 0);
    const overallUtilization =
      totalCapacity > 0 ? (totalFiles / totalCapacity) * 100 : 0;

    return {
      totalDesks: allDesks.length,
      activeDesks: allDesks.filter((d) => d.currentFileCount > 0).length,
      totalFiles,
      totalCapacity,
      overallUtilization: Math.round(overallUtilization * 100) / 100,
      desks: allDesks.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        type: d.type,
        currentFiles: d.currentFileCount,
        maxFiles: d.maxFilesPerDay,
        utilization: d.capacityUtilizationPercent,
        isFull: d.currentFileCount >= d.maxFilesPerDay,
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
      slaNorm?: number; // SLA norm in hours
    },
  ) {
    if (!userRoles.includes(UserRole.DEVELOPER)) {
      throw new ForbiddenException('Only Tech Panel can update desks');
    }

    return this.prisma.desk.update({
      where: { id: deskId },
      data,
    });
  }

  // Delete desk (soft delete)
  async deleteDesk(deskId: string, userId: string, userRoles: string[]) {
    if (!userRoles.includes(UserRole.DEVELOPER)) {
      throw new ForbiddenException('Only Tech Panel can delete desks');
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
