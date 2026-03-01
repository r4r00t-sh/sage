import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

export interface CreateNotificationDto {
  userId: string;
  type: string;
  title: string;
  message: string;
  fileId?: string;
  extensionReqId?: string;
  priority?: string;
  actionRequired?: boolean;
  actionType?: string;
  metadata?: any;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitMQService,
  ) {}

  async createNotification(data: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        fileId: data.fileId,
        extensionReqId: data.extensionReqId,
        priority: data.priority || 'normal',
        actionRequired: data.actionRequired || false,
        actionType: data.actionType,
        metadata: data.metadata,
      },
    });

    // Send to RabbitMQ for real-time delivery
    await this.rabbitmq.publish('notifications', {
      userId: data.userId,
      notification,
    });

    return notification;
  }

  async getUserNotifications(userId: string, includeRead = false) {
    const where: any = { userId };
    if (!includeRead) {
      where.isDismissed = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAsDismissed(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isDismissed: true, isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false, isDismissed: false },
    });
  }

  // Send file received notification
  async notifyFileReceived(
    recipientId: string,
    senderId: string,
    fileId: string,
    fileNumber: string,
    subject: string,
  ) {
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });

    return this.createNotification({
      userId: recipientId,
      type: 'file_received',
      title: 'File Received',
      message: `You have received file ${fileNumber}: "${subject}" from ${sender?.name || 'Unknown'}`,
      fileId,
      priority: 'high',
      actionRequired: true,
      actionType: 'request_extension',
      metadata: { senderId, fileNumber, subject },
    });
  }

  // Send extension request notification to sender (approver)
  async notifyExtensionRequest(
    approverId: string,
    requesterId: string,
    fileId: string,
    fileNumber: string,
    extensionReqId: string,
    additionalTime: number,
  ) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { name: true },
    });

    const hours = Math.floor(additionalTime / 3600);
    const timeStr =
      hours > 24 ? `${Math.floor(hours / 24)} days` : `${hours} hours`;

    return this.createNotification({
      userId: approverId,
      type: 'extension_request',
      title: 'Extra Time Request',
      message: `${requester?.name || 'A user'} requested ${timeStr} extra time for file ${fileNumber}`,
      fileId,
      extensionReqId,
      priority: 'high',
      actionRequired: true,
      actionType: 'approve_deny_extension',
      metadata: { requesterId, fileNumber, additionalTime },
    });
  }

  // Notify requester of extension decision
  async notifyExtensionDecision(
    requesterId: string,
    approverId: string,
    fileId: string,
    fileNumber: string,
    approved: boolean,
    remarks?: string,
  ) {
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { name: true },
    });

    return this.createNotification({
      userId: requesterId,
      type: approved ? 'extension_approved' : 'extension_denied',
      title: approved ? 'Extra Time Approved' : 'Extra Time Denied',
      message: approved
        ? `Your extra time request for file ${fileNumber} was approved by ${approver?.name || 'Unknown'}`
        : `Your extra time request for file ${fileNumber} was denied by ${approver?.name || 'Unknown'}${remarks ? `: ${remarks}` : ''}`,
      fileId,
      priority: approved ? 'normal' : 'high',
      metadata: { approverId, fileNumber, approved, remarks },
    });
  }

  // Notify admins of extension actions
  async notifyAdminsExtensionAction(
    departmentId: string,
    action: string, // 'requested', 'approved', 'denied'
    requesterId: string,
    approverId: string | null,
    fileId: string,
    fileNumber: string,
  ) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { name: true },
    });

    const approver = approverId
      ? await this.prisma.user.findUnique({
          where: { id: approverId },
          select: { name: true },
        })
      : null;

    // Get dept admin and super admin
    const admins = await this.prisma.user.findMany({
      where: {
        OR: [{ roles: { has: 'DEVELOPER' } }, { roles: { has: 'SUPER_ADMIN' } }, { roles: { has: 'DEPT_ADMIN' }, departmentId }],
        isActive: true,
      },
      select: { id: true },
    });

    const messages = {
      requested: `${requester?.name} requested extra time for file ${fileNumber}`,
      approved: `${approver?.name || 'Unknown'} approved extra time request from ${requester?.name} for file ${fileNumber}`,
      denied: `${approver?.name || 'Unknown'} denied extra time request from ${requester?.name} for file ${fileNumber}`,
    };

    for (const admin of admins) {
      await this.createNotification({
        userId: admin.id,
        type: `admin_extension_${action}`,
        title: `Extension ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        message: messages[action] || `Extension action: ${action}`,
        fileId,
        priority: 'normal',
        metadata: { requesterId, approverId, fileNumber, action },
      });
    }
  }

  // Notify admins of redlist
  async notifyAdminsRedList(
    departmentId: string,
    userId: string,
    fileId: string,
    fileNumber: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const admins = await this.prisma.user.findMany({
      where: {
        OR: [{ roles: { has: 'DEVELOPER' } }, { roles: { has: 'SUPER_ADMIN' } }, { roles: { has: 'DEPT_ADMIN' }, departmentId }],
        isActive: true,
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.createNotification({
        userId: admin.id,
        type: 'admin_file_redlisted',
        title: 'File Red Listed',
        message: `File ${fileNumber} assigned to ${user?.name || 'Unknown'} has been red listed due to timeout`,
        fileId,
        priority: 'urgent',
        metadata: { userId, fileNumber },
      });
    }
  }
}
