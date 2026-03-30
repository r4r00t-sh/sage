import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface UserAccessInfo {
  userId: string;
  roles: string[];
  departmentId: string | null;
  divisionId: string | null;
  /** Departments in scope for DEPT_ADMIN/APPROVAL_AUTHORITY. */
  departmentalScopeDepartmentIds?: string[];
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
      originDepartmentId?: string | null;
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

    const scopedDeptIds = user.departmentalScopeDepartmentIds;
    if (
      (isDeptAdmin || isApprovalAuthority) &&
      scopedDeptIds?.length &&
      scopedDeptIds.includes(file.departmentId)
    ) {
      return true;
    }

    // Check if file is assigned to the user
    if (file.assignedToId === user.userId) {
      return true;
    }

    // Check if user has an active FileAssignment (multi-forward inbox entry)
    const assignment = await this.prisma.fileAssignment.findFirst({
      where: {
        fileId: file.id,
        toUserId: user.userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });
    if (assignment) {
      return true;
    }

    // Check if user created the file
    if (file.createdById === user.userId) {
      return true;
    }

    // Host department: originator can always view (Rule 7 & 9)
    if (file.originDepartmentId) {
      if (
        (isDeptAdmin || isApprovalAuthority) &&
        scopedDeptIds?.length &&
        scopedDeptIds.includes(file.originDepartmentId)
      ) {
        return true;
      }
      if (
        !isDeptAdmin &&
        !isApprovalAuthority &&
        user.departmentId &&
        file.originDepartmentId === user.departmentId
      ) {
        return true;
      }
    }

    // IMPORTANT: For regular staff (Section Officer, Approval Authority,
    // Inward Desk, Dispatcher), access is restricted to:
    //  - files assigned directly to them
    //  - files they created
    //  - files explicitly forwarded to them in routing history
    // No broad department-wide visibility is granted here.

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

    const scopedDeptIds = user.departmentalScopeDepartmentIds;
    if ((isDeptAdmin || isApprovalAuthority) && scopedDeptIds?.length) {
      where.departmentId = { in: scopedDeptIds };
      return {
        where,
        canAccess: (file: any) => scopedDeptIds!.includes(file.departmentId),
      };
    }

    // For Section Officer, Approval Authority, Inward Desk and Dispatcher,
    // as well as the default case, we start from the same strict filter:
    // - assignedToId = user
    // - createdById = user
    // - routingHistory contains an entry sent to user
    // - fileAssignments: active assignment to user (multi-forward inbox)
    // - originDepartmentId = user's department (host sees all originated files)
    if (isSectionOfficer || isApprovalAuthority || isInwardDesk || isDispatcher) {
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
        {
          fileAssignments: {
            some: {
              toUserId: user.userId,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
          },
        },
        ...(user.departmentId ? [{ originDepartmentId: user.departmentId }] : []),
      ];

      // Additional inbound queue rules per role
      // DISPATCHER (Outward Desk): should only ever see files that are already APPROVED
      if (isDispatcher) {
        where.AND = [
          ...(where.AND ?? []),
          { status: 'APPROVED' },
        ];
      }

      // INWARD_DESK (Inward Desk): show files assigned to them (including when file was
      // just forwarded to this department and file.departmentId was set to ours), or
      // files from other departments not yet assigned (routing/assignment).
      if (isInwardDesk && user.departmentId) {
        where.AND = [
          ...(where.AND ?? []),
          {
            OR: [
              { assignedToId: user.userId },
              { departmentId: { not: user.departmentId } },
            ],
          },
        ];
      }

      return {
        where,
        canAccess: async (file: any) => {
          if (file.assignedToId === user.userId || file.createdById === user.userId) {
            return true;
          }
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

    // Default: only files assigned to user, created by user, forwarded to them, or active assignment
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
      {
        fileAssignments: {
          some: {
            toUserId: user.userId,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        },
      },
      ...(user.departmentId ? [{ originDepartmentId: user.departmentId }] : []),
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

