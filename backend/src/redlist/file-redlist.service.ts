import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export enum RedListReason {
  TIME_BREACH = 'TIME_BREACH',
  MISSING_DOCS = 'MISSING_DOCS',
  SYSTEM_ERR = 'SYSTEM_ERR',
  POLICY_AMBIGUITY = 'POLICY_AMBIGUITY',
  LEGAL_HOLD = 'LEGAL_HOLD',
}

@Injectable()
export class FileRedListService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Calculate Criticality Score for a red-listed file
   * Criticality Score = (Current Wait Time / SLA Norm) × Priority Weight
   */
  async calculateCriticalityScore(fileId: string): Promise<number> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        desk: { select: { slaNorm: true } },
      },
    });

    if (!file || !file.deskId) return 0;

    const movement = await this.prisma.fileMovement.findFirst({
      where: {
        fileId,
        status: { in: ['PENDING', 'IN_PROCESS', 'RED_LISTED'] },
      },
      orderBy: { arrivalTS: 'desc' },
      include: { desk: { select: { slaNorm: true } } },
    });

    if (!movement || !movement.desk.slaNorm) return 0;

    const now = new Date();
    const currentWaitTime = (now.getTime() - movement.arrivalTS.getTime()) / (1000 * 60 * 60); // in hours
    const slaNorm = movement.desk.slaNorm;

    // Priority weight based on file priority
    let priorityWeight = 1.0;
    if (file.priority === 'URGENT') priorityWeight = 2.0;
    else if (file.priority === 'HIGH') priorityWeight = 1.5;
    else if (file.priority === 'NORMAL') priorityWeight = 1.0;
    else priorityWeight = 0.8;

    const criticalityScore = (currentWaitTime / slaNorm) * priorityWeight;
    return Math.round(criticalityScore * 100) / 100;
  }

  /**
   * Check if file should be auto-red-listed based on time-based triggers
   * Auto-Fail thresholds:
   * - 4 Hours SLA: > 12 Hours (3x Factor)
   * - 2 Days SLA: > 5 Days (2.5x Factor)
   * - 1 Week SLA: > 14 Days (2x Factor)
   */
  async checkAutoRedListTrigger(fileId: string): Promise<{
    shouldRedList: boolean;
    reason?: string;
  }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { desk: { select: { slaNorm: true } } },
    });

    if (!file || !file.deskId || file.isRedListed) {
      return { shouldRedList: false };
    }

    const movement = await this.prisma.fileMovement.findFirst({
      where: {
        fileId,
        status: { in: ['PENDING', 'IN_PROCESS'] },
      },
      orderBy: { arrivalTS: 'desc' },
      include: { desk: { select: { slaNorm: true } } },
    });

    if (!movement || !movement.desk.slaNorm) {
      return { shouldRedList: false };
    }

    const now = new Date();
    const currentWaitTime = (now.getTime() - movement.arrivalTS.getTime()) / (1000 * 60 * 60); // in hours
    const slaNorm = movement.desk.slaNorm;

    // Determine safety factor based on SLA norm
    let safetyFactor = 2.0; // Default
    if (slaNorm <= 4) {
      safetyFactor = 3.0; // 4 hours -> 12 hours
    } else if (slaNorm <= 48) {
      safetyFactor = 2.5; // 2 days -> 5 days
    } else if (slaNorm <= 168) {
      safetyFactor = 2.0; // 1 week -> 14 days
    }

    const threshold = slaNorm * safetyFactor;

    if (currentWaitTime > threshold) {
      return {
        shouldRedList: true,
        reason: `TIME_BREACH: File has exceeded ${threshold} hours (${safetyFactor}x SLA norm of ${slaNorm} hours)`,
      };
    }

    return { shouldRedList: false };
  }

  /**
   * Red-list a file (automated or manual)
   */
  async redListFile(
    fileId: string,
    reason: RedListReason | string,
    blockerOwner?: string,
    manualRedListedBy?: string,
  ): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        desk: { select: { id: true, name: true } },
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Calculate criticality score
    const criticalityScore = await this.calculateCriticalityScore(fileId);

    // Update file
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        isRedListed: true,
        redListedAt: new Date(),
        redListReason: reason,
        criticalityScore,
        escalationLevel: 1, // Start at Level 1
        blockerOwner: blockerOwner || 'Unknown',
      },
    });

    // Update file movement status
    await this.prisma.fileMovement.updateMany({
      where: {
        fileId,
        status: { in: ['PENDING', 'IN_PROCESS'] },
      },
      data: {
        status: 'RED_LISTED',
      },
    });

    // Trigger Level 1 escalation
    await this.triggerEscalation(fileId, 1);

    // Apply Toxic File Penalty to desk
    if (file.deskId) {
      await this.applyToxicFilePenalty(file.deskId);
    }
  }

  /**
   * Escalation Matrix - The "Rescue" Protocol
   * Level 1: File turns Red -> Desk Operator + Team Lead (60 mins to comment)
   * Level 2: Red for > 24 Hours -> Operations Manager
   * Level 3: Red for > 72 Hours -> Dept Head / Audit Team
   */
  async triggerEscalation(fileId: string, level: number): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        desk: {
          include: {
            department: {
              include: {
                users: {
                  where: {
                    roles: { has: 'DEPT_ADMIN' },
                    isActive: true,
                  },
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!file) return;

    const recipients: string[] = [];

    if (level === 1) {
      // Level 1: Desk Operator + Team Lead
      if (file.assignedToId) {
        recipients.push(file.assignedToId);
      }
      // TODO: Add team lead lookup
    } else if (level === 2) {
      // Level 2: Operations Manager
      // TODO: Add operations manager lookup
      // For now, notify department admins
      if (file.desk?.department?.users) {
        file.desk.department.users.forEach((user) => {
          recipients.push(user.id);
        });
      }
    } else if (level === 3) {
      // Level 3: Dept Head / Audit Team
      if (file.desk?.department?.users) {
        file.desk.department.users.forEach((user) => {
          recipients.push(user.id);
        });
      }
    }

    // Send notifications
    for (const userId of recipients) {
      await this.notifications.createNotification({
        userId,
        type: 'file_redlisted_escalation',
        title: `File Red-Listed - Escalation Level ${level}`,
        message: `File ${file.fileNumber} has been red-listed and requires immediate attention. Escalation Level: ${level}`,
        fileId,
        priority: level === 3 ? 'urgent' : 'high',
        actionRequired: true,
        metadata: {
          escalationLevel: level,
          reason: file.redListReason,
          criticalityScore: file.criticalityScore,
        },
      });
    }

    // Update escalation level
    await this.prisma.file.update({
      where: { id: fileId },
      data: { escalationLevel: level },
    });
  }

  /**
   * Check and update escalation levels for red-listed files
   */
  async checkAndUpdateEscalations(): Promise<void> {
    const redListedFiles = await this.prisma.file.findMany({
      where: {
        isRedListed: true,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        redListedAt: true,
        escalationLevel: true,
      },
    });

    const now = new Date();

    for (const file of redListedFiles) {
      if (!file.redListedAt) continue;

      const hoursSinceRedList = (now.getTime() - file.redListedAt.getTime()) / (1000 * 60 * 60);
      const currentLevel = file.escalationLevel || 0;

      // Check if escalation needed
      if (hoursSinceRedList > 72 && currentLevel < 3) {
        await this.triggerEscalation(file.id, 3);
      } else if (hoursSinceRedList > 24 && currentLevel < 2) {
        await this.triggerEscalation(file.id, 2);
      }
    }
  }

  /**
   * Apply Toxic File Penalty to desk score
   * Subtract 5 points from Desk Score for every Red-Listed file currently active
   */
  async applyToxicFilePenalty(deskId: string): Promise<void> {
    // This will be applied when calculating desk score
    // The penalty is applied in the desk performance service
  }

  /**
   * Get Toxic File Penalty count for a desk
   */
  async getToxicFilePenaltyCount(deskId: string): Promise<number> {
    return this.prisma.file.count({
      where: {
        deskId,
        isRedListed: true,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });
  }

  /**
   * Get Red-List Morgue (Escalation Pit) - All red-listed files
   */
  async getRedListMorgue(departmentId?: string) {
    const where: any = {
      isRedListed: true,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    const files = await this.prisma.file.findMany({
      where,
      include: {
        desk: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true } },
        department: { select: { name: true, code: true } },
      },
      orderBy: [
        { criticalityScore: 'desc' }, // Sort by criticality (worst first)
        { redListedAt: 'asc' }, // Then by oldest
      ],
    });

    return files.map((file) => ({
      fileId: file.id,
      fileNumber: file.fileNumber,
      subject: file.subject,
      currentDesk: file.desk ? { id: file.desk.id, name: file.desk.name, code: file.desk.code } : null,
      reason: file.redListReason,
      daysOverdue: file.redListedAt
        ? Math.floor((Date.now() - file.redListedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      actionOwner: file.blockerOwner,
      criticalityScore: file.criticalityScore,
      escalationLevel: file.escalationLevel,
      assignedTo: file.assignedTo ? { id: file.assignedTo.id, name: file.assignedTo.name } : null,
      department: file.department,
    }));
  }

  /**
   * Rescue a file - Move from current desk to specialist desk or resolution queue
   */
  async rescueFile(
    fileId: string,
    targetDeskId: string,
    rescuedBy: string,
    remarks?: string,
  ): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || !file.isRedListed) {
      throw new Error('File is not red-listed or not found');
    }

    // Move file to new desk
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        deskId: targetDeskId,
        escalationLevel: 0, // Reset escalation
        blockerOwner: null,
      },
    });

    // Create new file movement
    await this.prisma.fileMovement.create({
      data: {
        fileId,
        deskId: targetDeskId,
        arrivalTS: new Date(),
        status: 'PENDING',
        slaNorm: null, // Will be set by desk
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'FILE_RESCUED',
        entityType: 'File',
        entityId: fileId,
        userId: rescuedBy,
        fileId,
        metadata: {
          fromDesk: file.deskId,
          toDesk: targetDeskId,
          remarks,
        },
      },
    });
  }

  /**
   * Manually red-list a file (for operators/supervisors)
   */
  async manualRedListFile(
    fileId: string,
    reason: RedListReason,
    blockerOwner: string,
    redListedBy: string,
    remarks?: string,
  ): Promise<void> {
    await this.redListFile(fileId, reason, blockerOwner, redListedBy);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'FILE_MANUALLY_REDLISTED',
        entityType: 'File',
        entityId: fileId,
        userId: redListedBy,
        fileId,
        metadata: {
          reason,
          blockerOwner,
          remarks,
        },
      },
    });
  }
}

