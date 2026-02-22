import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { FileRedListService, RedListReason } from './file-redlist.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class RedListService {
  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
    private rabbitmq: RabbitMQService,
    private fileRedListService: FileRedListService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateRedList() {
    console.log('Running red list check...');
    const now = new Date();

    // Get all pending/in-progress files
    const pendingFiles = await this.prisma.file.findMany({
      where: {
        isRedListed: false,
        isOnHold: false,
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
      select: { id: true },
    });

    console.log(`Checking ${pendingFiles.length} files for auto-red-list triggers`);

    // Check each file for auto-red-list triggers
    for (const file of pendingFiles) {
      const check = await this.fileRedListService.checkAutoRedListTrigger(file.id);
      if (check.shouldRedList) {
        await this.fileRedListService.redListFile(
          file.id,
          RedListReason.TIME_BREACH,
          'System',
        );
        console.log(`Auto-red-listed file ${file.id}: ${check.reason}`);
      }
    }

    // Check and update escalation levels
    await this.fileRedListService.checkAndUpdateEscalations();

    // Legacy check for overdue files (timeRemaining, dueDate, deskDueDate)
    const overdueFiles = await this.prisma.file.findMany({
      where: {
        OR: [
          { timeRemaining: { lte: 0 } },
          { dueDate: { lte: now } },
          { deskDueDate: { lte: now } },
        ],
        isRedListed: false,
        isOnHold: false,
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
      include: {
        assignedTo: true,
        department: true,
      },
    });

    console.log(`Found ${overdueFiles.length} legacy overdue files to red list`);

    // Mark legacy overdue files as red-listed
    for (const file of overdueFiles) {
      await this.fileRedListService.redListFile(
        file.id,
        RedListReason.TIME_BREACH,
        'System',
      );

      // Deduct points if file is assigned
      if (file.assignedToId) {
        await this.gamification.deductForRedList(
          file.assignedToId,
          file.id,
          file.fileNumber,
        );

        // Notify the assigned user
        await this.rabbitmq.publishToast({
          userId: file.assignedToId,
          type: 'file_redlisted',
          title: 'File Red Listed',
          message: `File ${file.fileNumber} has exceeded time limit and is now red listed`,
          fileId: file.id,
          priority: 'urgent',
        });
      }

      // Notify department admin and super admin
      const admins = await this.prisma.user.findMany({
        where: {
          OR: [
            { roles: { has: 'SUPER_ADMIN' } },
            { roles: { has: 'DEPT_ADMIN' }, departmentId: file.departmentId },
          ],
          isActive: true,
        },
        select: { id: true },
      });

      for (const admin of admins) {
        await this.rabbitmq.publishToast({
          userId: admin.id,
          type: 'admin_file_redlisted',
          title: 'File Red Listed',
          message: `File ${file.fileNumber} assigned to ${file.assignedTo?.name || 'Unknown'} has been red listed`,
          fileId: file.id,
          priority: 'high',
        });
      }
    }
  }

  async getRedListFiles(departmentId?: string) {
    const where: any = {
      isRedListed: true,
      status: {
        in: ['PENDING', 'IN_PROGRESS'],
      },
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    return this.prisma.file.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }
}
