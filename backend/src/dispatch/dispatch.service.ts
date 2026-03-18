import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MinIOService } from '../minio/minio.service';
import { FileStatus, FileAction, UserRole } from '@prisma/client';

@Injectable()
export class DispatchService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private minio: MinIOService,
  ) {}

  // Mark file as ready for dispatch (Administrator action)
  async prepareForDispatch(
    fileId: string,
    userId: string,
    userRoles: string[],
    remarks?: string,
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Only admins or dispatchers can prepare for dispatch
    if (
      !userRoles.includes(UserRole.DEVELOPER) &&
      !userRoles.includes(UserRole.SUPER_ADMIN) &&
      !userRoles.includes(UserRole.DEPT_ADMIN) &&
      !userRoles.includes(UserRole.DISPATCHER)
    ) {
      throw new ForbiddenException(
        'Only administrators or dispatchers can prepare files for dispatch',
      );
    }

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: userId,
        action: FileAction.DISPATCH_PREPARED,
        remarks: remarks || 'File prepared for dispatch',
      },
    });

    // Notify dispatcher
    const dispatcher = await this.prisma.user.findFirst({
      where: {
        roles: { has: UserRole.DISPATCHER },
        departmentId: file.departmentId,
      },
    });

    if (dispatcher) {
      await this.notifications.createNotification({
        userId: dispatcher.id,
        type: 'file_ready_dispatch',
        title: 'File Ready for Dispatch',
        message: `File ${file.fileNumber} is ready for dispatch: ${file.subject}`,
        fileId: file.id,
      });
    }

    return { message: 'File marked as ready for dispatch' };
  }

  // Dispatch file (Dispatcher action)
  async dispatchFile(
    fileId: string,
    userId: string,
    data: {
      dispatchMethod: string;
      trackingNumber?: string;
      recipientName?: string;
      recipientAddress?: string;
      recipientEmail?: string;
      remarks?: string;
      proofDocument?: {
        buffer: Buffer;
        filename: string;
        mimetype: string;
        size: number;
      };
      acknowledgementDocument?: {
        buffer: Buffer;
        filename: string;
        mimetype: string;
        size: number;
      };
    },
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { department: true, createdBy: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check if user is a dispatcher
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (
      !user?.roles?.includes(UserRole.DISPATCHER) &&
      !user?.roles?.includes(UserRole.DEVELOPER) && !user?.roles?.includes(UserRole.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Only dispatchers can dispatch files');
    }

    // Upload proof documents
    let proofS3Key: string | undefined;
    let acknowledgementS3Key: string | undefined;

    if (data.proofDocument) {
      proofS3Key = `dispatch/${fileId}/proof/${Date.now()}-${data.proofDocument.filename}`;
      await this.minio.uploadFile(
        proofS3Key,
        data.proofDocument.buffer,
        data.proofDocument.mimetype,
      );
    }

    if (data.acknowledgementDocument) {
      acknowledgementS3Key = `dispatch/${fileId}/acknowledgement/${Date.now()}-${data.acknowledgementDocument.filename}`;
      await this.minio.uploadFile(
        acknowledgementS3Key,
        data.acknowledgementDocument.buffer,
        data.acknowledgementDocument.mimetype,
      );
    }

    // Create dispatch proof record
    const dispatchProof = await this.prisma.dispatchProof.create({
      data: {
        fileId,
        dispatchedById: userId,
        dispatchMethod: data.dispatchMethod,
        trackingNumber: data.trackingNumber,
        recipientName: data.recipientName,
        recipientAddress: data.recipientAddress,
        recipientEmail: data.recipientEmail,
        proofDocumentS3Key: proofS3Key,
        acknowledgementS3Key: acknowledgementS3Key,
        remarks: data.remarks,
      },
    });

    // Update file status
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.APPROVED, // Or a new DISPATCHED status
        isClosed: true,
        closedAt: new Date(),
        assignedToId: null, // Unassign after dispatch
      },
    });

    // Close current process cycle when file is closed (Rule 3)
    if (file.currentProcessCycleId) {
      await this.prisma.processCycle.update({
        where: { id: file.currentProcessCycleId },
        data: { closedAt: new Date() },
      });
    }

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: userId,
        action: FileAction.DISPATCHED,
        remarks: data.remarks || `File dispatched via ${data.dispatchMethod}`,
      },
    });

    // Notify department admin
    const deptAdmin = await this.prisma.user.findFirst({
      where: {
        roles: { has: UserRole.DEPT_ADMIN },
        departmentId: file.departmentId,
      },
    });

    if (deptAdmin) {
      await this.notifications.createNotification({
        userId: deptAdmin.id,
        type: 'file_dispatched',
        title: 'File Dispatched',
        message: `File ${file.fileNumber} has been dispatched and closed`,
        fileId: file.id,
        metadata: { dispatchProofId: dispatchProof.id },
      });
    }

    // Notify file creator
    await this.notifications.createNotification({
      userId: file.createdById,
      type: 'file_dispatched',
      title: 'File Dispatched',
      message: `Your file ${file.fileNumber} has been dispatched`,
      fileId: file.id,
    });

    return {
      file: updatedFile,
      dispatchProof,
      message: 'File dispatched successfully',
    };
  }

  // Get dispatch proof
  async getDispatchProof(fileId: string) {
    return this.prisma.dispatchProof.findFirst({
      where: { fileId },
      include: {
        dispatchedBy: { select: { name: true, username: true } },
      },
      orderBy: { dispatchDate: 'desc' },
    });
  }

  // Get all dispatch proofs (for tracking)
  async getDispatchProofs(
    departmentId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    const where: any = {};
    if (departmentId) {
      where.file = { departmentId };
    }
    if (dateFrom || dateTo) {
      where.dispatchDate = {};
      if (dateFrom) where.dispatchDate.gte = dateFrom;
      if (dateTo) where.dispatchDate.lte = dateTo;
    }

    return this.prisma.dispatchProof.findMany({
      where,
      include: {
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
            department: { select: { name: true, code: true } },
          },
        },
        dispatchedBy: { select: { name: true, username: true } },
      },
      orderBy: { dispatchDate: 'desc' },
    });
  }

  // Download dispatch proof document
  async getDispatchProofDocument(
    dispatchProofId: string,
    documentType: 'proof' | 'acknowledgement',
  ) {
    const proof = await this.prisma.dispatchProof.findUnique({
      where: { id: dispatchProofId },
    });

    if (!proof) {
      throw new NotFoundException('Dispatch proof not found');
    }

    const s3Key =
      documentType === 'proof'
        ? proof.proofDocumentS3Key
        : proof.acknowledgementS3Key;

    if (!s3Key) {
      throw new NotFoundException(`${documentType} document not found`);
    }

    const stream = await this.minio.getFileStream(s3Key);
    const filename = s3Key.split('/').pop() || `dispatch-${documentType}.pdf`;

    return { stream, filename };
  }
}
