import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MinIOService } from '../minio/minio.service';
import { FileAction } from '@prisma/client';

@Injectable()
export class OpinionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private minio: MinIOService,
  ) {}

  // Request opinion from another department
  async requestOpinion(
    fileId: string,
    requestedById: string,
    data: {
      requestedToDepartmentId: string;
      requestedToDivisionId?: string;
      requestedToUserId?: string;
      requestReason?: string;
      specialPermissionGranted?: boolean;
    },
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { department: true, createdBy: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check if user can request opinion (should be assigned to file or be creator)
    if (
      file.assignedToId !== requestedById &&
      file.createdById !== requestedById
    ) {
      throw new ForbiddenException(
        'You are not authorized to request opinions for this file',
      );
    }

    // Create opinion request
    const opinionRequest = await this.prisma.opinionRequest.create({
      data: {
        fileId,
        requestedById,
        requestedFromDepartmentId: file.departmentId,
        requestedToDepartmentId: data.requestedToDepartmentId,
        requestedToDivisionId: data.requestedToDivisionId,
        requestedToUserId: data.requestedToUserId,
        requestReason: data.requestReason,
        specialPermissionGranted: data.specialPermissionGranted || false,
        status: 'pending',
      },
      include: {
        requestedToDepartment: { select: { name: true, code: true } },
        requestedToDivision: { select: { name: true } },
      },
    });

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: requestedById,
        action: FileAction.OPINION_REQUESTED,
        remarks: `Opinion requested from ${opinionRequest.requestedToDepartment.name}`,
      },
    });

    // Notify target department/users
    if (data.requestedToUserId) {
      await this.notifications.createNotification({
        userId: data.requestedToUserId,
        type: 'opinion_requested',
        title: 'Opinion Requested',
        message: `File ${file.fileNumber} requires your opinion: ${file.subject}`,
        fileId: file.id,
        metadata: { opinionRequestId: opinionRequest.id },
      });
    } else {
      // Notify department admin
      const deptAdmin = await this.prisma.user.findFirst({
        where: {
          roles: { has: 'DEPT_ADMIN' },
          departmentId: data.requestedToDepartmentId,
        },
      });
      if (deptAdmin) {
        await this.notifications.createNotification({
          userId: deptAdmin.id,
          type: 'opinion_requested',
          title: 'Opinion Requested',
          message: `File ${file.fileNumber} requires opinion from your department`,
          fileId: file.id,
          metadata: { opinionRequestId: opinionRequest.id },
        });
      }
    }

    return opinionRequest;
  }

  // Get files pending opinion (for opinion desk) - RECEIVED opinions
  async getPendingOpinions(userId: string, departmentId?: string) {
    const where: any = {
      status: 'pending',
    };

    if (departmentId) {
      where.requestedToDepartmentId = departmentId;
    } else {
      // Get user's department
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      if (user?.departmentId) {
        where.requestedToDepartmentId = user.departmentId;
      }
    }

    return this.prisma.opinionRequest.findMany({
      where,
      include: {
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
            description: true,
            priority: true,
            priorityCategory: true,
            createdAt: true,
            department: { select: { name: true, code: true } },
            createdBy: { select: { name: true } },
          },
        },
        requestedBy: { select: { name: true } },
        requestedFromDepartment: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get sent opinions (opinions requested by current user/department) - SENT opinions
  async getSentOpinions(userId: string, departmentId?: string) {
    const where: any = {};

    if (departmentId) {
      where.requestedFromDepartmentId = departmentId;
    } else {
      // Get user's department
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      if (user?.departmentId) {
        where.requestedFromDepartmentId = user.departmentId;
      }
    }

    return this.prisma.opinionRequest.findMany({
      where,
      include: {
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
            description: true,
            priority: true,
            priorityCategory: true,
            createdAt: true,
            department: { select: { name: true, code: true } },
            createdBy: { select: { name: true } },
          },
        },
        requestedBy: { select: { name: true } },
        requestedToDepartment: { select: { name: true, code: true } },
        requestedToDivision: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Forward opinion to another department/division
  async forwardOpinion(
    opinionRequestId: string,
    fromUserId: string,
    data: {
      requestedToDepartmentId: string;
      requestedToDivisionId?: string;
      requestReason?: string;
    },
  ) {
    const opinionRequest = await this.prisma.opinionRequest.findUnique({
      where: { id: opinionRequestId },
      include: { file: true },
    });

    if (!opinionRequest) {
      throw new NotFoundException('Opinion request not found');
    }

    // Check if user is authorized to forward this opinion
    const fromUser = await this.prisma.user.findUnique({
      where: { id: fromUserId },
      select: { departmentId: true, roles: true },
    });

    if (
      opinionRequest.requestedFromDepartmentId !== fromUser?.departmentId &&
      !fromUser?.roles?.includes('DEVELOPER') && !fromUser?.roles?.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'You are not authorized to forward this opinion request',
      );
    }

    // Create new opinion request to the forwarded department
    const newOpinionRequest = await this.prisma.opinionRequest.create({
      data: {
        fileId: opinionRequest.fileId,
        requestedById: fromUserId,
        requestedFromDepartmentId: opinionRequest.requestedFromDepartmentId,
        requestedToDepartmentId: data.requestedToDepartmentId,
        requestedToDivisionId: data.requestedToDivisionId,
        requestReason: data.requestReason || opinionRequest.requestReason,
        specialPermissionGranted: opinionRequest.specialPermissionGranted,
        status: 'pending',
      },
      include: {
        requestedToDepartment: { select: { name: true, code: true } },
        requestedToDivision: { select: { name: true } },
      },
    });

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId: opinionRequest.fileId,
        fromUserId: fromUserId,
        action: FileAction.OPINION_REQUESTED,
        remarks: `Opinion forwarded to ${newOpinionRequest.requestedToDepartment.name}`,
      },
    });

    return newOpinionRequest;
  }

  // Get file for opinion (view-only mode)
  async getFileForOpinion(opinionRequestId: string, userId: string) {
    const opinionRequest = await this.prisma.opinionRequest.findUnique({
      where: { id: opinionRequestId },
      include: {
        file: {
          include: {
            department: true,
            createdBy: { select: { name: true } },
            attachments: {
              select: {
                id: true,
                filename: true,
                mimeType: true,
                size: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!opinionRequest) {
      throw new NotFoundException('Opinion request not found');
    }

    // Check if user is authorized to view this opinion request
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, divisionId: true },
    });

    if (
      opinionRequest.requestedToDepartmentId !== user?.departmentId ||
      (opinionRequest.requestedToDivisionId &&
        opinionRequest.requestedToDivisionId !== user?.divisionId)
    ) {
      throw new ForbiddenException(
        'You are not authorized to view this opinion request',
      );
    }

    // Get notes - only current desk notes if special permission not granted
    let notes;
    if (opinionRequest.specialPermissionGranted) {
      // Can view all notes
      notes = await this.prisma.note.findMany({
        where: { fileId: opinionRequest.fileId },
        include: {
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Only view notes from the requesting department
      notes = await this.prisma.note.findMany({
        where: {
          fileId: opinionRequest.fileId,
          user: {
            departmentId: opinionRequest.requestedFromDepartmentId,
          },
        },
        include: {
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Get opinion notes
    const opinionNotes = await this.prisma.opinionNote.findMany({
      where: { opinionRequestId },
      include: {
        addedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      opinionRequest,
      file: {
        ...opinionRequest.file,
        notes,
        opinionNotes,
      },
    };
  }

  // Add opinion note
  async addOpinionNote(
    opinionRequestId: string,
    userId: string,
    content: string,
  ) {
    const opinionRequest = await this.prisma.opinionRequest.findUnique({
      where: { id: opinionRequestId },
    });

    if (!opinionRequest) {
      throw new NotFoundException('Opinion request not found');
    }

    // Check authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    if (opinionRequest.requestedToDepartmentId !== user?.departmentId) {
      throw new ForbiddenException(
        'You are not authorized to add opinion notes',
      );
    }

    return this.prisma.opinionNote.create({
      data: {
        opinionRequestId,
        content,
        addedById: userId,
      },
      include: {
        addedBy: { select: { name: true } },
      },
    });
  }

  // Provide opinion (submit response)
  async provideOpinion(
    opinionRequestId: string,
    userId: string,
    data: {
      opinionNote: string;
      attachmentFiles?: Array<{
        buffer: Buffer;
        filename: string;
        mimetype: string;
        size: number;
      }>;
    },
  ) {
    const opinionRequest = await this.prisma.opinionRequest.findUnique({
      where: { id: opinionRequestId },
      include: { file: true },
    });

    if (!opinionRequest) {
      throw new NotFoundException('Opinion request not found');
    }

    // Check authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    if (opinionRequest.requestedToDepartmentId !== user?.departmentId) {
      throw new ForbiddenException(
        'You are not authorized to provide this opinion',
      );
    }

    // Upload attachments if provided
    const attachmentS3Keys: string[] = [];
    if (data.attachmentFiles && data.attachmentFiles.length > 0) {
      for (const file of data.attachmentFiles) {
        const s3Key = `opinions/${opinionRequestId}/${Date.now()}-${file.filename}`;
        await this.minio.uploadFile(s3Key, file.buffer, file.mimetype);
        attachmentS3Keys.push(s3Key);
      }
    }

    // Update opinion request
    const updateData: any = {
      opinionNote: data.opinionNote,
      respondedById: userId,
      respondedAt: new Date(),
      status: 'responded',
    };

    if (attachmentS3Keys.length > 0) {
      updateData.opinionAttachments = attachmentS3Keys;
    }

    const updated = await this.prisma.opinionRequest.update({
      where: { id: opinionRequestId },
      data: updateData,
      include: {
        requestedBy: { select: { name: true } },
        file: { select: { fileNumber: true, subject: true } },
      },
    });

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId: opinionRequest.fileId,
        fromUserId: userId,
        action: FileAction.OPINION_PROVIDED,
        remarks: `Opinion provided by ${user.departmentId}`,
      },
    });

    // Notify requester
    await this.notifications.createNotification({
      userId: opinionRequest.requestedById,
      type: 'opinion_provided',
      title: 'Opinion Provided',
      message: `Opinion has been provided for file ${updated.file.fileNumber}`,
      fileId: opinionRequest.fileId,
      metadata: { opinionRequestId },
    });

    return updated;
  }

  // Return opinion (send back to requester)
  async returnOpinion(opinionRequestId: string, userId: string) {
    const opinionRequest = await this.prisma.opinionRequest.findUnique({
      where: { id: opinionRequestId },
      include: { file: true },
    });

    if (!opinionRequest) {
      throw new NotFoundException('Opinion request not found');
    }

    // Check authorization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    if (opinionRequest.requestedToDepartmentId !== user?.departmentId) {
      throw new ForbiddenException(
        'You are not authorized to return this opinion',
      );
    }

    const updated = await this.prisma.opinionRequest.update({
      where: { id: opinionRequestId },
      data: {
        status: 'returned',
        respondedById: userId,
        respondedAt: new Date(),
      },
    });

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId: opinionRequest.fileId,
        fromUserId: userId,
        action: FileAction.CONSULTATION_RETURNED,
        remarks: 'Opinion returned to requester',
      },
    });

    // Notify requester
    await this.notifications.createNotification({
      userId: opinionRequest.requestedById,
      type: 'opinion_returned',
      title: 'Opinion Returned',
      message: `Opinion has been returned for file ${opinionRequest.file.fileNumber}`,
      fileId: opinionRequest.fileId,
      metadata: { opinionRequestId },
    });

    return updated;
  }
}
