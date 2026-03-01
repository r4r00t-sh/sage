import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface UserAccessInfo {
  userId: string;
  roles: string[];
  departmentId: string | null;
  divisionId: string | null;
}

export interface FileAccessFilter {
  where: any;
  canAccess: (file: any) => Promise<boolean> | boolean;
}

@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if a user can access a file based on RBAC rules
   */
  async canAccessFile(
    file: {
      id: string;
      departmentId: string;
      currentDivisionId?: string | null;
      assignedToId?: string | null;
      createdById: string;
    },
    user: UserAccessInfo,
  ): Promise<boolean> {
    const userRoles = user.roles ?? [];
    const isDeveloper = userRoles.includes(UserRole.DEVELOPER);
    const isSuperAdmin = userRoles.includes(UserRole.SUPER_ADMIN);
    const isSupport = userRoles.includes(UserRole.SUPPORT);
    const isDeptAdmin = userRoles.includes(UserRole.DEPT_ADMIN);
    const isSectionOfficer = userRoles.includes(UserRole.SECTION_OFFICER);
    const isInwardDesk = userRoles.includes(UserRole.INWARD_DESK);
    const isDispatcher = userRoles.includes(UserRole.DISPATCHER);
    const isApprovalAuthority = userRoles.includes(UserRole.APPROVAL_AUTHORITY);

    // Developer, Super Admin and Support can access everything
    if (isDeveloper || isSuperAdmin || isSupport) {
      return true;
    }

    // Department Admin can access files in their department
    if (isDeptAdmin && user.departmentId) {
      if (file.departmentId === user.departmentId) {
        return true;
      }
    }

    // Check if file is assigned to the user
    if (file.assignedToId === user.userId) {
      return true;
    }

    // Check if user created the file
    if (file.createdById === user.userId) {
      return true;
    }

    // Check if file was forwarded to user's division/department
    if (user.departmentId && file.departmentId === user.departmentId) {
      // File is in user's department
      if (isSectionOfficer || isApprovalAuthority) {
        // Section Officers and Approval Authorities can see files in their department
        // that are assigned to their division or to users in their division
        if (user.divisionId && file.currentDivisionId === user.divisionId) {
          return true;
        }
        // Also check if assigned to a user in their division
        if (file.assignedToId) {
          const assignedUser = await this.prisma.user.findUnique({
            where: { id: file.assignedToId },
            select: { divisionId: true, departmentId: true },
          });
          if (assignedUser?.divisionId === user.divisionId) {
            return true;
          }
        }
      }
    }

    // Inward Desk and Dispatcher: files in their department OR assigned to them (e.g. forwarded from another dept)
    if (isInwardDesk || isDispatcher) {
      if (file.assignedToId === user.userId) return true;
      if (user.departmentId && file.departmentId === user.departmentId) return true;
    }

    // Check routing history to see if file was forwarded to user
    const routingHistory = await this.prisma.fileRouting.findFirst({
      where: {
        fileId: file.id,
        toUserId: user.userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (routingHistory) {
      return true;
    }

    return false;
  }

  /**
   * Build Prisma where clause for file access based on user role
   */
  buildFileAccessFilter(user: UserAccessInfo): FileAccessFilter {
    const userRoles = user.roles ?? [];
    const isDeveloper = userRoles.includes(UserRole.DEVELOPER);
    const isSuperAdmin = userRoles.includes(UserRole.SUPER_ADMIN);
    const isSupport = userRoles.includes(UserRole.SUPPORT);
    const isDeptAdmin = userRoles.includes(UserRole.DEPT_ADMIN);
    const isSectionOfficer = userRoles.includes(UserRole.SECTION_OFFICER);
    const isInwardDesk = userRoles.includes(UserRole.INWARD_DESK);
    const isDispatcher = userRoles.includes(UserRole.DISPATCHER);
    const isApprovalAuthority = userRoles.includes(UserRole.APPROVAL_AUTHORITY);

    const where: any = {};

    // Developer, Super Admin and Support can see everything
    if (isDeveloper || isSuperAdmin || isSupport) {
      return {
        where: {},
        canAccess: () => true,
      };
    }

    // Department Admin can see files in their department
    if (isDeptAdmin && user.departmentId) {
      where.departmentId = user.departmentId;
      return {
        where,
        canAccess: (file: any) => file.departmentId === user.departmentId,
      };
    }

    // Section Officer: files assigned to them, created by them, or in their department/division
    if (isSectionOfficer) {
      const conditions: any[] = [
        { assignedToId: user.userId },
        { createdById: user.userId },
      ];

      if (user.departmentId) {
        // Files in their department
        conditions.push({ departmentId: user.departmentId });
        // Files in their division
        if (user.divisionId) {
          conditions.push({ currentDivisionId: user.divisionId });
        }
      }

      // Also include files forwarded to them via routing history
      where.OR = [
        ...conditions,
        {
          routingHistory: {
            some: {
              toUserId: user.userId,
            },
          },
        },
      ];

      return {
        where,
        canAccess: async (file: any) => {
          if (file.assignedToId === user.userId || file.createdById === user.userId) {
            return true;
          }
          if (user.departmentId && file.departmentId === user.departmentId) {
            if (user.divisionId && file.currentDivisionId === user.divisionId) {
              return true;
            }
            // Check if assigned to user in same division
            if (file.assignedToId) {
              const assignedUser = await this.prisma.user.findUnique({
                where: { id: file.assignedToId },
                select: { divisionId: true },
              });
              if (assignedUser?.divisionId === user.divisionId) {
                return true;
              }
            }
          }
          // Check routing history
          const routing = await this.prisma.fileRouting.findFirst({
            where: {
              fileId: file.id,
              toUserId: user.userId,
            },
          });
          return !!routing;
        },
      };
    }

    // Approval Authority: files in their department
    if (isApprovalAuthority && user.departmentId) {
      where.departmentId = user.departmentId;
      return {
        where,
        canAccess: (file: any) => file.departmentId === user.departmentId,
      };
    }

    // Inward Desk and Dispatcher: files in their department OR assigned to them (forwarded from another dept)
    if (isInwardDesk || isDispatcher) {
      where.OR = [
        { assignedToId: user.userId },
        ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
      ];
      return {
        where,
        canAccess: (file: any) =>
          file.assignedToId === user.userId ||
          (!!user.departmentId && file.departmentId === user.departmentId),
      };
    }

    // Default: only files assigned to user, created by user, or forwarded to them
    where.OR = [
      { assignedToId: user.userId },
      { createdById: user.userId },
      {
        routingHistory: {
          some: {
            toUserId: user.userId,
          },
        },
      },
    ];

    return {
      where,
      canAccess: async (file: any) => {
        if (file.assignedToId === user.userId || file.createdById === user.userId) {
          return true;
        }
        // Check routing history
        const routing = await this.prisma.fileRouting.findFirst({
          where: {
            fileId: file.id,
            toUserId: user.userId,
          },
        });
        return !!routing;
      },
    };
  }
}

