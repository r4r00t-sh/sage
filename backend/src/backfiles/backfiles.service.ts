import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinIOService } from '../minio/minio.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class BackFilesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinIOService,
  ) {}

  // Create/Scan back file
  async createBackFile(
    userId: string,
    userRoles: string[],
    data: {
      fileNumber: string;
      subject: string;
      description?: string;
      departmentId: string;
      file?: {
        buffer: Buffer;
        filename: string;
        mimetype: string;
        size: number;
      };
      tags?: Array<{ name: string; value?: string }>;
    },
  ) {
    // Check if back file already exists
    const existing = await this.prisma.backFile.findUnique({
      where: { fileNumber: data.fileNumber },
    });

    if (existing) {
      throw new ForbiddenException(
        'Back file with this file number already exists',
      );
    }

    // Upload file if provided
    let s3Key: string | undefined;
    if (data.file) {
      s3Key = `backfiles/${data.departmentId}/${Date.now()}-${data.file.filename}`;
      await this.minio.uploadFile(s3Key, data.file.buffer, data.file.mimetype);
    }

    // Create back file
    const backFile = await this.prisma.backFile.create({
      data: {
        fileNumber: data.fileNumber,
        subject: data.subject,
        description: data.description,
        departmentId: data.departmentId,
        s3Key,
        s3Bucket: this.minio.getBucketName(),
        isScanned: !!data.file,
        scannedAt: data.file ? new Date() : undefined,
        scannedById: data.file ? userId : undefined,
        isHidden: true, // Hidden by default
        accessRoles: [UserRole.DEVELOPER, UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN], // Default access
      },
    });

    // Add tags if provided
    if (data.tags && data.tags.length > 0) {
      await Promise.all(
        data.tags.map((tag) =>
          this.prisma.backFileTag.create({
            data: {
              backFileId: backFile.id,
              tagName: tag.name,
              tagValue: tag.value,
            },
          }),
        ),
      );
    }

    return backFile;
  }

  // Link back file to active file
  async linkBackFileToFile(
    userId: string,
    fileId: string,
    backFileId: string,
    linkReason?: string,
  ) {
    // Check if file exists
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check if back file exists
    const backFile = await this.prisma.backFile.findUnique({
      where: { id: backFileId },
    });

    if (!backFile) {
      throw new NotFoundException('Back file not found');
    }

    // Check if already linked
    const existingLink = await this.prisma.fileBackFileLink.findUnique({
      where: {
        fileId_backFileId: {
          fileId,
          backFileId,
        },
      },
    });

    if (existingLink) {
      throw new ForbiddenException('Back file is already linked to this file');
    }

    // Create link
    const link = await this.prisma.fileBackFileLink.create({
      data: {
        fileId,
        backFileId,
        linkReason,
        linkedById: userId,
      },
    });

    // Update file indicator
    await this.prisma.file.update({
      where: { id: fileId },
      data: { hasBackFiles: true },
    });

    return link;
  }

  // Get back files linked to a file
  async getBackFilesForFile(
    fileId: string,
    userId: string,
    userRoles: string[],
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const links = await this.prisma.fileBackFileLink.findMany({
      where: { fileId },
      include: {
        backFile: {
          include: {
            tags: true,
            department: { select: { name: true, code: true } },
          },
        },
        linkedBy: { select: { name: true } },
      },
    });

    // Filter based on access roles
    const accessibleBackFiles = links.filter((link) => {
      const backFile = link.backFile;
      if (userRoles.includes(UserRole.DEVELOPER) || userRoles.includes(UserRole.SUPER_ADMIN)) return true;
      if (backFile.accessRoles.some((r) => userRoles.includes(r))) return true;
      if (backFile.departmentId === file.departmentId) return true;
      return false;
    });

    return accessibleBackFiles.map((link) => ({
      ...link.backFile,
      linkReason: link.linkReason,
      linkedBy: link.linkedBy,
      linkedAt: link.createdAt,
    }));
  }

  // Get all back files (with access control)
  async getBackFiles(
    userId: string,
    userRole: UserRole,
    filters?: {
      departmentId?: string;
      isHidden?: boolean;
      tagName?: string;
      search?: string;
    },
  ) {
    const where: any = {};

    // Access control
    if (userRole !== UserRole.DEVELOPER && userRole !== UserRole.SUPER_ADMIN) {
      where.OR = [
        { accessRoles: { has: userRole } },
        { department: { users: { some: { id: userId } } } },
      ];
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters?.isHidden !== undefined) {
      where.isHidden = filters.isHidden;
    }

    if (filters?.tagName) {
      where.tags = { some: { tagName: filters.tagName } };
    }

    if (filters?.search) {
      where.OR = [
        ...(where.OR || []),
        { fileNumber: { contains: filters.search, mode: 'insensitive' } },
        { subject: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.backFile.findMany({
      where,
      include: {
        department: { select: { name: true, code: true } },
        tags: true,
        _count: {
          select: { linkedFiles: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get back file by ID
  async getBackFileById(
    backFileId: string,
    userId: string,
    userRoles: string[],
  ) {
    const backFile = await this.prisma.backFile.findUnique({
      where: { id: backFileId },
      include: {
        department: { select: { name: true, code: true } },
        tags: true,
        linkedFiles: {
          include: {
            file: {
              select: {
                id: true,
                fileNumber: true,
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!backFile) {
      throw new NotFoundException('Back file not found');
    }

    // Check access
    if (!userRoles.includes(UserRole.DEVELOPER) && !userRoles.includes(UserRole.SUPER_ADMIN)) {
      if (!backFile.accessRoles.some((r) => userRoles.includes(r))) {
        // Check if user is in same department
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { departmentId: true },
        });

        if (user?.departmentId !== backFile.departmentId) {
          throw new ForbiddenException(
            'You do not have access to this back file',
          );
        }
      }
    }

    return backFile;
  }

  // Update back file access
  async updateBackFileAccess(
    backFileId: string,
    userId: string,
    userRoles: string[],
    data: {
      isHidden?: boolean;
      accessRoles?: string[];
    },
  ) {
    if (!userRoles.includes(UserRole.DEVELOPER) && !userRoles.includes(UserRole.SUPER_ADMIN) && !userRoles.includes(UserRole.DEPT_ADMIN)) {
      throw new ForbiddenException(
        'Only administrators can update back file access',
      );
    }

    return this.prisma.backFile.update({
      where: { id: backFileId },
      data: {
        isHidden: data.isHidden,
        accessRoles: data.accessRoles,
      },
    });
  }

  // Add tag to back file
  async addTag(backFileId: string, tagName: string, tagValue?: string) {
    return this.prisma.backFileTag.create({
      data: {
        backFileId,
        tagName,
        tagValue,
      },
    });
  }

  // Remove tag from back file
  async removeTag(tagId: string) {
    return this.prisma.backFileTag.delete({
      where: { id: tagId },
    });
  }

  // Unlink back file from file
  async unlinkBackFile(fileId: string, backFileId: string) {
    await this.prisma.fileBackFileLink.delete({
      where: {
        fileId_backFileId: {
          fileId,
          backFileId,
        },
      },
    });

    // Check if file still has back files
    const remainingLinks = await this.prisma.fileBackFileLink.count({
      where: { fileId },
    });

    if (remainingLinks === 0) {
      await this.prisma.file.update({
        where: { id: fileId },
        data: { hasBackFiles: false },
      });
    }

    return { message: 'Back file unlinked successfully' };
  }

  // Download back file
  async downloadBackFile(
    backFileId: string,
    userId: string,
    userRoles: string[],
  ) {
    const backFile = await this.getBackFileById(backFileId, userId, userRoles);

    if (!backFile.s3Key) {
      throw new NotFoundException('Back file document not found');
    }

    const stream = await this.minio.getFileStream(backFile.s3Key);
    const filename =
      backFile.s3Key.split('/').pop() || `backfile-${backFile.fileNumber}.pdf`;

    return { stream, filename, mimeType: 'application/pdf' };
  }
}
