import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinIOService } from '../minio/minio.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { TimingService } from '../timing/timing.service';
import { CapacityService } from '../capacity/capacity.service';
import { RbacService } from '../auth/rbac.service';
import { FileStatus, FilePriority, FileAction, UserRole } from '@prisma/client';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinIOService,
    private rabbitmq: RabbitMQService,
    private timing: TimingService,
    private capacityService: CapacityService,
    private rbac: RbacService,
  ) {}

  async createFile(data: {
    subject: string;
    description?: string;
    departmentId: string;
    divisionId?: string;
    createdById: string;
    priority?: FilePriority;
    dueDate?: Date;
    files?: {
      buffer: Buffer;
      filename: string;
      mimetype: string;
      size: number;
    }[];
  }) {
    // Permission check: INWARD_DESK cannot create new files
    const user = await this.prisma.user.findUnique({
      where: { id: data.createdById },
      select: { roles: true },
    });

    if (user?.roles?.includes('INWARD_DESK') && !user?.roles?.includes('DEPT_ADMIN') && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes('DEVELOPER')) {
      throw new ForbiddenException('Inward Desk users cannot create new files. They can only receive and forward files.');
    }

    // Generate file number with department and division codes
    const fileNumber = await this.generateFileNumber(
      data.departmentId,
      data.divisionId,
    );

    // Create file record first
    const file = await this.prisma.file.create({
      data: {
        fileNumber,
        subject: data.subject,
        description: data.description,
        departmentId: data.departmentId,
        currentDivisionId: data.divisionId,
        createdById: data.createdById,
        priority: data.priority || FilePriority.NORMAL,
        dueDate: data.dueDate,
        s3Bucket: this.minio.getBucketName(),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        department: true,
      },
    });

    // Upload attachments if provided
    if (data.files && data.files.length > 0) {
      const attachments = await Promise.all(
        data.files.map(async (uploadFile) => {
          const s3Key = await this.minio.uploadFile(
            uploadFile.filename,
            uploadFile.buffer,
            uploadFile.mimetype,
          );
          return {
            fileId: file.id,
            filename: uploadFile.filename,
            s3Key,
            s3Bucket: this.minio.getBucketName(),
            mimeType: uploadFile.mimetype,
            size: uploadFile.size,
            uploadedById: data.createdById,
          };
        }),
      );

      await this.prisma.attachment.createMany({
        data: attachments,
      });

      // Update the main file's s3Key with the first attachment for backward compatibility
      if (attachments.length > 0) {
        await this.prisma.file.update({
          where: { id: file.id },
          data: { s3Key: attachments[0].s3Key },
        });
      }
    }

    // Calculate initial time remaining
    if (data.dueDate) {
      await this.timing.updateTimeRemaining(file.id);
    }

    // Create audit log
    await this.createAuditLog(
      file.id,
      data.createdById,
      'created',
      'File created',
    );

    return file;
  }

  async addAttachment(
    fileId: string,
    userId: string,
    uploadFile: {
      buffer: Buffer;
      filename: string;
      mimetype: string;
      size: number;
    },
  ) {
    const file = await this.prisma.file.findUnique({ 
      where: { id: fileId },
      include: { createdBy: { select: { departmentId: true } } },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Permission check: INWARD_DESK cannot attach documents to incoming files
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true, departmentId: true },
    });

    if (user?.roles?.includes('INWARD_DESK') && !user?.roles?.includes('DEPT_ADMIN') && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes('DEVELOPER')) {
      // Check if this is an incoming file (not created by this user's department)
      if (file.createdBy.departmentId !== user.departmentId) {
        throw new ForbiddenException('Inward Desk users cannot attach documents to incoming files from other departments.');
      }
    }

    const s3Key = await this.minio.uploadFile(
      uploadFile.filename,
      uploadFile.buffer,
      uploadFile.mimetype,
    );

    const attachment = await this.prisma.attachment.create({
      data: {
        fileId,
        filename: uploadFile.filename,
        s3Key,
        s3Bucket: this.minio.getBucketName(),
        mimeType: uploadFile.mimetype,
        size: uploadFile.size,
        uploadedById: userId,
      },
    });

    await this.createAuditLog(
      fileId,
      userId,
      'attachment_added',
      `Added attachment: ${uploadFile.filename}`,
    );

    return attachment;
  }

  async deleteAttachment(attachmentId: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { file: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Delete from MinIO
    await this.minio.deleteFile(attachment.s3Key);

    // Delete from database
    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    await this.createAuditLog(
      attachment.fileId,
      userId,
      'attachment_deleted',
      `Deleted attachment: ${attachment.filename}`,
    );

    return { message: 'Attachment deleted' };
  }

  async getAttachmentUrl(attachmentId: string): Promise<string> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return this.minio.getFileUrl(attachment.s3Key, 3600);
  }

  async getAttachmentStream(attachmentId: string): Promise<{
    stream: NodeJS.ReadableStream;
    filename: string;
    mimeType: string;
  }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const stream = await this.minio.getFileStream(attachment.s3Key);
    return {
      stream,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    };
  }

  async getLegacyFileStream(s3Key: string): Promise<NodeJS.ReadableStream> {
    if (!s3Key) {
      throw new NotFoundException('File key not provided');
    }
    return this.minio.getFileStream(s3Key);
  }

  async getAllFiles(
    userId: string,
    userRoles: string[],
    departmentId?: string | null,
    options?: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    // Get user's division ID for proper RBAC
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, roles: true, departmentId: true, divisionId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build RBAC filter
    const accessFilter = this.rbac.buildFileAccessFilter({
      userId: user.id,
      roles: user.roles ?? [],
      departmentId: user.departmentId,
      divisionId: user.divisionId,
    });

    const where: any = { ...accessFilter.where };

    // Status filter
    if (options?.status) {
      where.status = options.status;
    }

    // Search filter - need to combine with role-based OR filter properly
    if (options?.search) {
      const searchCondition = {
        OR: [
          { fileNumber: { contains: options.search, mode: 'insensitive' } },
          { subject: { contains: options.search, mode: 'insensitive' } },
          { description: { contains: options.search, mode: 'insensitive' } },
        ],
      };

      // If there's already an OR clause from role-based filtering, use AND to combine
      if (where.OR) {
        const existingOr = where.OR;
        delete where.OR;
        where.AND = [{ OR: existingOr }, searchCondition];
      } else {
        where.OR = searchCondition.OR;
      }
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, username: true } },
          assignedTo: { select: { id: true, name: true, username: true } },
          department: { select: { id: true, name: true, code: true } },
          currentDivision: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Recent files for the current user (by audit log activity), for dashboard widget */
  async getRecentFiles(userId: string, limit = 10) {
    // Get user info for RBAC
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, roles: true, departmentId: true, divisionId: true },
    });

    if (!user) {
      return [];
    }

    // Build RBAC filter
    const accessFilter = this.rbac.buildFileAccessFilter({
      userId: user.id,
      roles: user.roles ?? [],
      departmentId: user.departmentId,
      divisionId: user.divisionId,
    });

    const recentLogs = await this.prisma.auditLog.findMany({
      where: { userId, fileId: { not: null } },
      select: { fileId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit * 3,
    });
    const seen = new Set<string>();
    const fileIdsWithTime: { fileId: string; lastAccessedAt: Date }[] = [];
    for (const log of recentLogs) {
      if (log.fileId && !seen.has(log.fileId)) {
        seen.add(log.fileId);
        fileIdsWithTime.push({ fileId: log.fileId, lastAccessedAt: log.createdAt });
        if (fileIdsWithTime.length >= limit) break;
      }
    }
    if (fileIdsWithTime.length === 0) return [];
    
    // Apply RBAC filter to recent files
    const where: any = {
      id: { in: fileIdsWithTime.map((f) => f.fileId) },
      ...accessFilter.where,
    };

    const files = await this.prisma.file.findMany({
      where,
      select: {
        id: true,
        fileNumber: true,
        subject: true,
        priority: true,
        status: true,
      },
    });
    const byId = new Map(files.map((f) => [f.id, f]));
    return fileIdsWithTime
      .map(({ fileId, lastAccessedAt }) => {
        const file = byId.get(fileId);
        if (!file) return null;
        return {
          id: file.id,
          fileNumber: file.fileNumber,
          subject: file.subject,
          priority: file.priority,
          status: file.status,
          lastAccessedAt: lastAccessedAt.toISOString(),
        };
      })
      .filter(Boolean);
  }

  async getFileById(id: string, userId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        department: true,
        currentDivision: true,
        intendedDivision: { select: { id: true, name: true, code: true } },
        intendedUser: { select: { id: true, name: true, username: true } },
        originDesk: { select: { id: true, name: true, code: true, department: { select: { name: true, code: true } }, division: { select: { name: true } } } },
        notes: {
          include: {
            user: { 
              select: { 
                id: true, 
                name: true, 
                email: true,
                departmentId: true, // Needed for note filtering
              } 
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        routingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                roles: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                division: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Get user for permission checks
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        roles: true, 
        departmentId: true,
        divisionId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check RBAC access
    const hasAccess = await this.rbac.canAccessFile(
      {
        id: file.id,
        departmentId: file.departmentId,
        currentDivisionId: file.currentDivisionId,
        assignedToId: file.assignedToId,
        createdById: file.createdById,
      },
      {
        userId: user.id,
        roles: user.roles ?? [],
        departmentId: user.departmentId,
        divisionId: user.divisionId,
      },
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const userRoles = user.roles ?? [];
    const isInwardDesk = userRoles.includes('INWARD_DESK') && !userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEVELOPER');
    const isDispatcher = userRoles.includes('DISPATCHER') && !userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEVELOPER');
    const isSectionOfficer = userRoles.includes('SECTION_OFFICER') && !userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEVELOPER');
    const isDeptAdmin = userRoles.includes('DEPT_ADMIN') || userRoles.includes('SUPER_ADMIN') || userRoles.includes('DEVELOPER');
    const isApprovalAuthority = userRoles.includes('APPROVAL_AUTHORITY') && !userRoles.includes('DEPT_ADMIN') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEVELOPER');

    // Filter notes based on role and file status
    let filteredNotes = file.notes;
    
    if (isInwardDesk) {
      // INWARD_DESK: Can only view latest notes on incoming files (to assist routing)
      // Cannot view notes after file leaves dispatch
      const lastDispatch = file.routingHistory.find(r => r.actionString === 'dispatch' || r.actionString === 'forward');
      if (lastDispatch) {
        // File has been dispatched/forwarded, only show notes before dispatch
        filteredNotes = file.notes.filter(note => {
          const noteDate = new Date(note.createdAt);
          const dispatchDate = new Date(lastDispatch.createdAt);
          return noteDate < dispatchDate;
        });
      }
      // If file is from other department, only show latest note
      if (file.departmentId !== user.departmentId) {
        filteredNotes = filteredNotes.slice(0, 1); // Only latest note
      }
    } else if (isSectionOfficer) {
      // SECTION_OFFICER: Can view notes on own files anywhere; notes on other dept files within dept
      if (file.departmentId === user.departmentId) {
        // Own department file - can view all notes
        filteredNotes = file.notes;
      } else {
        // Other department file - only view notes from own department (internal circuitry)
        filteredNotes = file.notes.filter(note => 
          note.user.departmentId === user.departmentId
        );
      }
    } else if (isDeptAdmin || isApprovalAuthority) {
      // DEPT_ADMIN and APPROVAL_AUTHORITY: Can view notes of any file within the dept; notes of own dept files anywhere
      if (file.departmentId === user.departmentId) {
        // Own department file - can view all notes
        filteredNotes = file.notes;
      } else {
        // Other department file - can view all notes (as per spec: "notes of own dept files anywhere")
        filteredNotes = file.notes;
      }
    } else if (isDispatcher) {
      // DISPATCHER: Can view notes (no specific restriction mentioned, but cannot add notes)
      filteredNotes = file.notes;
    } else {
      // Tier 1 — Standard User: only the last note (sender's / most recent) for immediate context
      filteredNotes = file.notes.slice(0, 1);
    }

    // Get file URL if exists (backward compatibility)
    let fileUrl: string | null = null;
    if (file.s3Key) {
      fileUrl = await this.minio.getFileUrl(file.s3Key, 3600);
    }

    // Generate proxy URLs for all attachments (to avoid MinIO signature issues)
    // These URLs point to the backend proxy endpoint
    // Include uploader information (name, department, division, roles)
    const attachmentsWithUrls = file.attachments.map((att) => ({
      ...att,
      url: `/files/attachments/${att.id}/download`,
      uploadedBy: att.uploadedBy ? {
        id: att.uploadedBy.id,
        name: att.uploadedBy.name,
        roles: att.uploadedBy.roles,
        department: att.uploadedBy.department ? {
          id: att.uploadedBy.department.id,
          name: att.uploadedBy.department.name,
        } : null,
        division: att.uploadedBy.division ? {
          id: att.uploadedBy.division.id,
          name: att.uploadedBy.division.name,
        } : null,
      } : null,
    }));

    return {
      ...file,
      notes: filteredNotes, // Return filtered notes based on permissions
      fileUrl: file.s3Key
        ? `/files/attachments/legacy/download?key=${encodeURIComponent(file.s3Key)}`
        : null,
      attachments: attachmentsWithUrls,
    };
  }

  async forwardFile(
    fileId: string,
    fromUserId: string,
    toDivisionId: string | undefined,
    toDepartmentId: string | undefined, // For dispatcher forwarding to other departments
    toUserId: string | null, // Can be null for internal forwarding (auto-assign to inward desk)
    remarks?: string,
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { assignedTo: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const fromUser = await this.prisma.user.findUnique({
      where: { id: fromUserId },
      select: { roles: true, departmentId: true },
    });
    if (!fromUser) {
      throw new NotFoundException('User not found');
    }
    const userRoles = fromUser.roles ?? [];
    const isDispatcher = userRoles.includes('DISPATCHER') && !userRoles.includes('DEPT_ADMIN');
    const isRestrictedRole = 
      (userRoles.includes('INWARD_DESK') || 
       userRoles.includes('SECTION_OFFICER')) &&
      !userRoles.includes('DEPT_ADMIN');

    let finalToUserId = toUserId;
    let finalToDivisionId = toDivisionId;

    // Special handling for DISPATCHER: can only forward to other departments
    if (isDispatcher) {
      if (!toDepartmentId) {
        throw new BadRequestException('Please select a department to forward the file');
      }

      if (toDepartmentId === fromUser.departmentId) {
        throw new ForbiddenException(
          'Dispatchers can only forward files to other departments, not within their own department.',
        );
      }

      // Find any inward desk user in the target department
      const inwardDeskUser = await this.prisma.user.findFirst({
        where: {
          departmentId: toDepartmentId,
          roles: { has: 'INWARD_DESK' },
          isActive: true,
        },
        include: {
          division: {
            select: { id: true },
          },
        },
        orderBy: {
          createdAt: 'asc', // Get the first one created
        },
      });

      if (!inwardDeskUser) {
        throw new NotFoundException(
          `No inward desk user found in the target department. Please ensure an inward desk user is assigned to this department.`,
        );
      }

      finalToUserId = inwardDeskUser.id;

      // If inward desk user has a division, use it; otherwise find first division in the department
      if (inwardDeskUser.division?.id) {
        finalToDivisionId = inwardDeskUser.division.id;
      } else {
        const firstDivision = await this.prisma.division.findFirst({
          where: {
            departmentId: toDepartmentId,
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        
        if (!firstDivision) {
          throw new NotFoundException(
            `No division found in the target department. Please ensure at least one division exists.`,
          );
        }
        
        finalToDivisionId = firstDivision.id;
      }
    }
    // For restricted roles (INWARD_DESK, SECTION_OFFICER) forwarding inside department.
    // Section officer: always to division's inward desk and set intended*. Inward desk: can forward to specific user or to division inward.
    else if (isRestrictedRole && fromUser.departmentId) {
      if (!toDivisionId) {
        throw new BadRequestException('Please select a division to forward the file');
      }

      const toDivision = await this.prisma.division.findUnique({
        where: { id: toDivisionId },
        select: { departmentId: true },
      });

      if (!toDivision || toDivision.departmentId !== fromUser.departmentId) {
        throw new ForbiddenException(
          'You can only forward files to divisions within your own department.',
        );
      }

      const isInwardDeskSender = userRoles.includes('INWARD_DESK');
      if (isInwardDeskSender && toUserId) {
        // Inward desk forwarding to intended user: assign directly to that user
        finalToUserId = toUserId;
        finalToDivisionId = toDivisionId;
      } else {
        // Section officer or inward desk without user: assign to division's inward desk and store intended
        const inwardDeskUser = await this.prisma.user.findFirst({
          where: {
            divisionId: toDivisionId,
            roles: { has: 'INWARD_DESK' },
            isActive: true,
          },
          select: { id: true },
        });
        if (!inwardDeskUser) {
          throw new NotFoundException(
            `No inward desk user found for division. Please ensure an inward desk user is assigned to this division.`,
          );
        }
        finalToUserId = inwardDeskUser.id;
        finalToDivisionId = toDivisionId;
      }
    }
    // Admin forwarding outside department: department required, division and user optional. Always to dept inward desk.
    else if (!isDispatcher && !isRestrictedRole && toDepartmentId) {
      if (toDepartmentId === fromUser.departmentId) {
        throw new BadRequestException('Use Inside Department to forward within your department.');
      }

      const inwardDeskUser = await this.prisma.user.findFirst({
        where: {
          departmentId: toDepartmentId,
          roles: { has: 'INWARD_DESK' },
          isActive: true,
        },
        include: { division: { select: { id: true } } },
        orderBy: { createdAt: 'asc' },
      });

      if (!inwardDeskUser) {
        throw new NotFoundException(
          `No inward desk user found in the target department. Please ensure an inward desk user is assigned to this department.`,
        );
      }

      finalToUserId = inwardDeskUser.id;
      finalToDivisionId =
        inwardDeskUser.division?.id ??
        (
          await this.prisma.division.findFirst({
            where: { departmentId: toDepartmentId },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          })
        )?.id ??
        undefined;
    }
    // Admin internal: division required, user optional; always to division inward desk.
    else if (!isDispatcher && !isRestrictedRole && toDivisionId) {
      const toDivision = await this.prisma.division.findUnique({
        where: { id: toDivisionId },
        select: { departmentId: true },
      });
      if (!toDivision || toDivision.departmentId !== fromUser.departmentId) {
        throw new ForbiddenException(
          'You can only forward to divisions within your own department when using Inside Department.',
        );
      }
      const inwardDeskUser = await this.prisma.user.findFirst({
        where: {
          divisionId: toDivisionId,
          roles: { has: 'INWARD_DESK' },
          isActive: true,
        },
        select: { id: true },
      });
      if (!inwardDeskUser) {
        throw new NotFoundException(
          `No inward desk user found for division. Please ensure an inward desk user is assigned to this division.`,
        );
      }
      finalToUserId = inwardDeskUser.id;
      finalToDivisionId = toDivisionId;
    }

    if (!finalToUserId) {
      throw new BadRequestException('Recipient user is required');
    }

    if (!finalToDivisionId) {
      throw new BadRequestException('Target division is required');
    }

    // When assigning to inward desk, store intended division/user so inward can one-click forward
    const recipient = await this.prisma.user.findFirst({
      where: { id: finalToUserId },
      select: { roles: true },
    });
    const isSendingToInwardDesk = recipient?.roles?.includes('INWARD_DESK') ?? false;
    const setIntended =
      isSendingToInwardDesk &&
      (isDispatcher || isRestrictedRole || !!toDepartmentId || !!toDivisionId);
    const intendedDivisionId = setIntended ? (toDivisionId ?? null) : null;
    const intendedUserId = setIntended ? (toUserId ?? null) : null;

    let isQueued = false;
    try {
      const capacity = await this.capacityService.getUserCapacity(finalToUserId);
      if (capacity.currentFileCount >= capacity.maxFilesPerDay) {
        isQueued = true;
      }
    } catch {
      // If capacity check fails, proceed with normal assign
    }

    const nextOrder =
      (await this.prisma.forwardQueue
        .aggregate({
          where: { toUserId: finalToUserId },
          _max: { sortOrder: true },
        })
        .then((r) => (r._max.sortOrder ?? 0) + 1))
      ?? 1;

    // Get the assigned user to find their division/department for desk lookup
    const assignedUser = await this.prisma.user.findUnique({
      where: { id: finalToUserId },
      select: { divisionId: true, departmentId: true },
    });

    // Direct Forward (Override Workflow): only Super Admin can send directly to a user in another department
    if (
      toUserId &&
      finalToUserId === toUserId &&
      assignedUser?.departmentId &&
      fromUser.departmentId &&
      assignedUser.departmentId !== fromUser.departmentId &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER')
    ) {
      throw new ForbiddenException(
        'Only Super Admin or Developer can direct forward (override workflow) to a user in another department.',
      );
    }

    const now = new Date();
    let allottedTimeInSeconds: number | null = null;
    let deskDueDate: Date | null = null;
    let deskId: string | null = null;

    // Try to find a desk in the user's division or department
    if (assignedUser) {
      const orConditions: any[] = [];
      if (assignedUser.divisionId) {
        orConditions.push({ divisionId: assignedUser.divisionId });
      }
      if (assignedUser.departmentId) {
        orConditions.push({ departmentId: assignedUser.departmentId });
      }

      const desk = await this.prisma.desk.findFirst({
        where: {
          isActive: true,
          ...(orConditions.length > 0 && { OR: orConditions }),
        },
        select: { id: true, slaNorm: true },
        orderBy: { createdAt: 'asc' }, // Get the first available desk
      });

      // Use desk SLA norm, or default from system settings (seeded as 48 hours)
      const defaultSetting = await this.prisma.systemSettings.findUnique({
        where: { key: 'defaultSlaNormHours' },
        select: { value: true },
      }).catch(() => null);
      const defaultSlaHours = defaultSetting ? parseInt(defaultSetting.value, 10) : 48;
      const slaHours = desk?.slaNorm ?? (Number.isNaN(defaultSlaHours) ? 48 : defaultSlaHours);
      if (desk?.id) deskId = desk.id;
      allottedTimeInSeconds = slaHours * 3600; // Convert hours to seconds
      deskDueDate = new Date(now.getTime() + allottedTimeInSeconds * 1000);
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        assignedToId: finalToUserId,
        currentDivisionId: finalToDivisionId,
        status: FileStatus.IN_PROGRESS,
        isInQueue: isQueued,
        ...(deskId && { deskId }),
        deskArrivalTime: now,
        ...(allottedTimeInSeconds !== null && {
          allottedTime: allottedTimeInSeconds,
          deskDueDate: deskDueDate,
        }),
        intendedDivisionId,
        intendedUserId,
      },
    });

    // Recalculate timer if allotted time was set
    if (allottedTimeInSeconds !== null) {
      await this.timing.updateTimeRemaining(fileId);
    }

    if (isQueued) {
      await this.prisma.forwardQueue.create({
        data: {
          fileId,
          toUserId: finalToUserId,
          toDivisionId: finalToDivisionId,
          fromUserId: fromUserId,
          remarks: remarks ?? undefined,
          sortOrder: nextOrder,
        },
      });
    }

    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId,
        toUserId: finalToUserId,
        toDivisionId: finalToDivisionId,
        action: FileAction.FORWARDED,
        actionString: 'forward',
        remarks,
      },
    });

    await this.createAuditLog(
      fileId,
      fromUserId,
      'forward',
      remarks || (isQueued ? 'File forwarded (queued)' : 'File forwarded'),
    );

    if (finalToUserId) {
      if (!isQueued) {
        await this.rabbitmq.publishToast({
          userId: finalToUserId,
          type: 'file_received',
          title: 'New File Assigned',
          message: `File ${file.fileNumber}: ${file.subject}`,
          fileId: file.id,
          actions: [
            {
              label: 'Request Extra Time',
              action: 'request_extra_time',
              payload: { fileId },
            },
          ],
        });
      } else {
        await this.rabbitmq.publishToast({
          userId: finalToUserId,
          type: 'file_received',
          title: 'File Queued',
          message: `File ${file.fileNumber} is in your queue (desk at capacity). It will move to your inbox when you have space.`,
          fileId: file.id,
        });
      }
    }

    await this.processQueueForUser(fromUserId);

    return updatedFile;
  }

  async processQueueForUser(userId: string): Promise<void> {
    const next = await this.prisma.forwardQueue.findFirst({
      where: { toUserId: userId },
      orderBy: { sortOrder: 'asc' },
      include: { file: true },
    });
    if (!next) return;
    await this.prisma.$transaction([
      this.prisma.file.update({
        where: { id: next.fileId },
        data: { isInQueue: false },
      }),
      this.prisma.forwardQueue.delete({ where: { id: next.id } }),
    ]);
    await this.rabbitmq.publishToast({
      userId,
      type: 'file_received',
      title: 'File from queue',
      message: `File ${next.file.fileNumber}: ${next.file.subject} is now in your inbox.`,
      fileId: next.fileId,
    });
  }

  async getQueueForUser(userId: string) {
    return this.prisma.forwardQueue.findMany({
      where: { toUserId: userId },
      orderBy: { sortOrder: 'asc' },
      include: {
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
        fromUser: { select: { id: true, name: true } },
      },
    });
  }

  async claimFromQueue(fileId: string, userId: string) {
    const entry = await this.prisma.forwardQueue.findFirst({
      where: { fileId, toUserId: userId },
      include: { file: true },
    });
    if (!entry) {
      throw new NotFoundException(
        'File not found in your queue or already claimed',
      );
    }
    await this.prisma.$transaction([
      this.prisma.file.update({
        where: { id: fileId },
        data: { isInQueue: false },
      }),
      this.prisma.forwardQueue.delete({ where: { id: entry.id } }),
    ]);
    await this.rabbitmq.publishToast({
      userId,
      type: 'file_received',
      title: 'File claimed from queue',
      message: `File ${entry.file.fileNumber}: ${entry.file.subject} is now in your inbox.`,
      fileId: entry.fileId,
    });
    return this.prisma.file.findUnique({
      where: { id: fileId },
      include: { assignedTo: true, department: true },
    });
  }

  async approveAndForward(
    fileId: string,
    userId: string,
    remarks?: string,
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        assignedTo: {
          include: { division: true },
        },
        currentDivision: true,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { division: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRoles = (user.roles ?? []) as string[];
    const isSectionOfficer = userRoles.includes('SECTION_OFFICER');
    const isApprovalAuthority = userRoles.includes('APPROVAL_AUTHORITY');

    if (!isSectionOfficer && !isApprovalAuthority) {
      throw new ForbiddenException(
        'Only Section Officers and Approval Authorities can use approve and forward',
      );
    }

    // Determine target role and division
    let targetRole: string;
    let targetDivisionId: string | null = null;

    if (isSectionOfficer) {
      // Section Officer -> Approval Authority in same division
      targetRole = 'APPROVAL_AUTHORITY';
      targetDivisionId = user.divisionId || file.currentDivisionId;
    } else if (isApprovalAuthority) {
      // Approval Authority -> Dispatcher in same division
      targetRole = 'DISPATCHER';
      targetDivisionId = user.divisionId || file.currentDivisionId;
    } else {
      throw new ForbiddenException('Invalid role for approve and forward');
    }

    if (!targetDivisionId) {
      throw new BadRequestException(
        'File must be assigned to a division to use approve and forward',
      );
    }

    // Find the target user
    const targetUser = await this.prisma.user.findFirst({
      where: {
        divisionId: targetDivisionId,
        roles: { has: targetRole as any },
        isActive: true,
      },
      include: { division: true },
    });

    if (!targetUser) {
      throw new NotFoundException(
        `No ${targetRole} found in the division. Please ensure a ${targetRole} is assigned to this division.`,
      );
    }

    // First, approve the file
    const approvedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.APPROVED,
      },
    });

    // Create approval routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: userId,
        action: FileAction.APPROVED,
        actionString: 'approve',
        remarks: remarks || 'Approved and forwarded',
      },
    });

    // Create audit log for approval
    await this.createAuditLog(
      fileId,
      userId,
      'approve',
      remarks || 'File approved',
    );

    // Then forward to the target user
    const forwardedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        assignedToId: targetUser.id,
        currentDivisionId: targetDivisionId,
        status: FileStatus.IN_PROGRESS, // Reset to IN_PROGRESS after forwarding
      },
    });

    // Create forwarding routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: userId,
        toUserId: targetUser.id,
        toDivisionId: targetDivisionId,
        action: FileAction.FORWARDED,
        actionString: 'forward',
        remarks: remarks || `Approved and forwarded to ${targetUser.name}`,
      },
    });

    // Create audit log for forwarding
    await this.createAuditLog(
      fileId,
      userId,
      'forward',
      remarks || `Approved and forwarded to ${targetUser.name}`,
    );

    let isQueued = false;
    try {
      const capacity = await this.capacityService.getUserCapacity(targetUser.id);
      if (capacity.currentFileCount >= capacity.maxFilesPerDay) {
        isQueued = true;
      }
    } catch {
      // ignore
    }

    if (isQueued) {
      const nextOrder =
        (await this.prisma.forwardQueue
          .aggregate({
            where: { toUserId: targetUser.id },
            _max: { sortOrder: true },
          })
          .then((r) => (r._max.sortOrder ?? 0) + 1))
        ?? 1;
      await this.prisma.forwardQueue.create({
        data: {
          fileId,
          toUserId: targetUser.id,
          toDivisionId: targetDivisionId,
          fromUserId: userId,
          remarks: remarks ?? undefined,
          sortOrder: nextOrder,
        },
      });
      await this.prisma.file.update({
        where: { id: fileId },
        data: { isInQueue: true },
      });
      await this.rabbitmq.publishToast({
        userId: targetUser.id,
        type: 'file_received',
        title: 'File Queued',
        message: `File ${file.fileNumber} is in your queue (desk at capacity).`,
        fileId: file.id,
      });
    } else {
      await this.rabbitmq.publishToast({
        userId: targetUser.id,
        type: 'file_received',
        title: 'New File Assigned',
        message: `File ${file.fileNumber}: ${file.subject}`,
        fileId: file.id,
        actions: [
          {
            label: 'Request Extra Time',
            action: 'request_extra_time',
            payload: { fileId },
          },
        ],
      });
    }

    await this.processQueueForUser(userId);

    return {
      file: forwardedFile,
      approvedBy: user.name,
      forwardedTo: targetUser.name,
      forwardedToRole: targetRole,
    };
  }

  async performAction(
    fileId: string,
    userId: string,
    action: string,
    remarks?: string,
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true, departmentId: true },
    });
    const roles = (actor?.roles ?? []) as string[];
    const isDeveloper = roles.includes('DEVELOPER');
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    const isDeptAdmin = roles.includes('DEPT_ADMIN');

    if (action === 'hold') {
      if (!isDeveloper && !isSuperAdmin && !isDeptAdmin) {
        throw new ForbiddenException('Only Department Admin, Developer or Super Admin can hold files');
      }
      if (isDeptAdmin && !isDeveloper && !isSuperAdmin && file.departmentId !== actor?.departmentId) {
        throw new ForbiddenException('Department Admin can only hold files within their department');
      }
    }
    if (action === 'release') {
      if (!isDeveloper && !isSuperAdmin && !isDeptAdmin) {
        throw new ForbiddenException('Only Department Admin, Developer or Super Admin can release files from hold');
      }
      if (isDeptAdmin && !isDeveloper && !isSuperAdmin && file.departmentId !== actor?.departmentId) {
        throw new ForbiddenException('Department Admin can only release files within their department');
      }
    }

    let newStatus: FileStatus;
    let fileAction: FileAction;

    switch (action) {
      case 'approve':
        newStatus = FileStatus.APPROVED;
        fileAction = FileAction.APPROVED;
        break;
      case 'reject':
        newStatus = FileStatus.REJECTED;
        fileAction = FileAction.REJECTED;
        break;
      case 'return':
      case 'return_to_previous':
        newStatus = FileStatus.RETURNED;
        fileAction = FileAction.RETURNED_TO_PREVIOUS;
        break;
      case 'return_to_host':
        newStatus = FileStatus.RETURNED;
        fileAction = FileAction.RETURNED_TO_HOST;
        break;
      case 'hold':
        newStatus = FileStatus.ON_HOLD;
        fileAction = FileAction.ON_HOLD;
        break;
      case 'release':
        newStatus = FileStatus.IN_PROGRESS;
        fileAction = FileAction.RELEASED_FROM_HOLD;
        break;
      default:
        throw new ForbiddenException('Invalid action');
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: newStatus,
        isOnHold: action === 'hold',
        holdReason: action === 'hold' ? remarks : null,
      },
    });

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: userId,
        action: fileAction,
        actionString: action,
        remarks,
      },
    });

    // Create audit log
    await this.createAuditLog(
      fileId,
      userId,
      action,
      remarks || `File ${action}`,
    );

    return updatedFile;
  }

  async requestExtraTime(
    fileId: string,
    userId: string,
    additionalDays: number,
    reason?: string,
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        createdBy: true,
        department: true,
        routingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          where: { toUserId: userId },
        },
      },
    });

    if (!file || file.assignedToId !== userId) {
      throw new ForbiddenException('You are not assigned to this file');
    }

    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Find who sent the file to current user (the approver)
    const lastRouting = file.routingHistory[0];
    const approverId = lastRouting?.fromUserId || file.createdById;
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { name: true },
    });

    const additionalTimeSeconds = additionalDays * 24 * 60 * 60;

    // Create extension request record
    const extensionRequest = await this.prisma.timeExtensionRequest.create({
      data: {
        fileId,
        requestedById: userId,
        requestedByName: requester?.name,
        reason: reason || 'Extra time needed',
        additionalTime: additionalTimeSeconds,
        approverId,
        approverName: approver?.name,
        status: 'pending',
      },
    });

    // Send toast to approver (the person who sent the file)
    await this.rabbitmq.publishToast({
      userId: approverId,
      type: 'extension_request',
      title: 'Extra Time Request',
      message: `${requester?.name || 'User'} requested ${additionalDays} additional days for file ${file.fileNumber}`,
      fileId: file.id,
      extensionReqId: extensionRequest.id,
      actions: [
        {
          label: 'Approve',
          action: 'approve_extension',
          payload: { extensionReqId: extensionRequest.id },
        },
        {
          label: 'Deny',
          action: 'deny_extension',
          payload: { extensionReqId: extensionRequest.id },
        },
      ],
    });

    // Create audit log
    await this.createAuditLog(
      fileId,
      userId,
      'request_extra_time',
      `Requested ${additionalDays} additional days`,
    );

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
        type: 'admin_extension_requested',
        title: 'Extension Requested',
        message: `${requester?.name || 'User'} requested extra time for file ${file.fileNumber}`,
        fileId: file.id,
      });
    }

    return { message: 'Extension request sent', extensionRequest };
  }

  async approveExtension(
    extensionReqId: string,
    userId: string,
    approved: boolean,
    remarks?: string,
  ) {
    const request = await this.prisma.timeExtensionRequest.findUnique({
      where: { id: extensionReqId },
      include: {
        file: {
          include: { department: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Extension request not found');
    }

    if (request.approverId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const userRoles = (user?.roles ?? []) as string[];
      if (!user) {
        throw new ForbiddenException('User not found');
      }
      if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('SUPPORT')) {
        throw new ForbiddenException(
          'Only Developer, Super Admin or Support can grant time extensions when not the sender. Sender can accept/deny.',
        );
      }
    }

    const approver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Update extension request
    await this.prisma.timeExtensionRequest.update({
      where: { id: extensionReqId },
      data: {
        isApproved: approved,
        approvedAt: new Date(),
        approvedById: userId,
        approvalRemarks: remarks,
        status: approved ? 'approved' : 'denied',
      },
    });

    if (approved) {
      // Extend the file's time limits
      const additionalSeconds = request.additionalTime;
      const file = request.file;

      const newDueDate = file.dueDate
        ? new Date(file.dueDate.getTime() + additionalSeconds * 1000)
        : new Date(Date.now() + additionalSeconds * 1000);

      const newDeskDueDate = file.deskDueDate
        ? new Date(file.deskDueDate.getTime() + additionalSeconds * 1000)
        : null;

      await this.prisma.file.update({
        where: { id: file.id },
        data: {
          dueDate: newDueDate,
          deskDueDate: newDeskDueDate,
          allottedTime: (file.allottedTime || 0) + additionalSeconds,
        },
      });

      // Recalculate timer
      await this.timing.updateTimeRemaining(file.id);
    }

    // Notify requester
    await this.rabbitmq.publishToast({
      userId: request.requestedById,
      type: approved ? 'extension_approved' : 'extension_denied',
      title: approved ? 'Extra Time Approved' : 'Extra Time Denied',
      message: approved
        ? `Your extra time request for file ${request.file.fileNumber} was approved by ${approver?.name || 'Admin'}`
        : `Your extra time request for file ${request.file.fileNumber} was denied${remarks ? `: ${remarks}` : ''}`,
      fileId: request.fileId,
    });

    // Notify admins
    const admins = await this.prisma.user.findMany({
      where: {
        OR: [
          { roles: { has: 'SUPER_ADMIN' } },
          { roles: { has: 'DEPT_ADMIN' }, departmentId: request.file.departmentId },
        ],
        isActive: true,
        id: { not: userId }, // Don't notify the approver
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.rabbitmq.publishToast({
        userId: admin.id,
        type: `admin_extension_${approved ? 'approved' : 'denied'}`,
        title: `Extension ${approved ? 'Approved' : 'Denied'}`,
        message: `${approver?.name || 'Admin'} ${approved ? 'approved' : 'denied'} extra time for file ${request.file.fileNumber}`,
        fileId: request.fileId,
      });
    }

    // Create audit log
    await this.createAuditLog(
      request.fileId,
      userId,
      approved ? 'approve_extra_time' : 'deny_extra_time',
      remarks || `Extension ${approved ? 'approved' : 'denied'}`,
    );

    return { success: true, approved };
  }

  async getExtensionRequests(fileId: string) {
    return this.prisma.timeExtensionRequest.findMany({
      where: { fileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingExtensionRequests(userId: string) {
    return this.prisma.timeExtensionRequest.findMany({
      where: {
        approverId: userId,
        status: 'pending',
      },
      include: {
        file: {
          select: { id: true, fileNumber: true, subject: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recallFile(
    fileId: string,
    userId: string,
    userRoles: string[],
    userDepartmentId: string | null,
    remarks?: string,
  ) {
    const isDeveloper = userRoles.includes('DEVELOPER');
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isSupport = userRoles.includes('SUPPORT');
    const isDeptAdmin = userRoles.includes('DEPT_ADMIN');
    if (!isDeveloper && !isSuperAdmin && !isSupport && !isDeptAdmin) {
      throw new ForbiddenException('Only Department Admin, Support, or Super Admin can recall files');
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (isDeptAdmin && !isDeveloper && !isSuperAdmin && !isSupport) {
      if (file.departmentId !== userDepartmentId) {
        throw new ForbiddenException('Department Admin can only recall files within their department');
      }
    }

    const previousAssigneeId = file.assignedToId;

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.RECALLED,
        assignedToId: null,
      },
    });

    if (previousAssigneeId) {
      await this.processQueueForUser(previousAssigneeId);
    }

    // Create routing history
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: userId,
        action: FileAction.RECALLED,
        actionString: 'recall',
        remarks: remarks || 'File recalled by Super Admin',
      },
    });

    // Create audit log
    await this.createAuditLog(
      fileId,
      userId,
      'recall',
      remarks || 'File recalled',
    );

    return updatedFile;
  }

  /**
   * SAGE: 3-letter uppercase abbreviation from division/section name (e.g. ACCOUNTS → ACC).
   */
  private divisionNameToAbbr(name: string): string {
    const cleaned = name.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length <= 3) return cleaned;
    return cleaned.slice(0, 3);
  }

  private async generateFileNumber(
    departmentId: string,
    divisionId?: string,
  ): Promise<string> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const deptCode = department.code.toUpperCase();

    // SAGE: 3-letter abbreviation from division name; avoid duplicate prefix
    let divisionAbbr = 'GEN';
    if (divisionId) {
      const division = await this.prisma.division.findUnique({
        where: { id: divisionId },
      });
      if (division) {
        divisionAbbr = this.divisionNameToAbbr(division.name);
      }
    }

    const year = new Date().getFullYear();

    const count = await this.prisma.file.count({
      where: {
        departmentId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    });

    const seq = String(count + 1).padStart(4, '0');

    // SAGE Rule 1: Eliminate duplicate prefix (e.g. FIN-FIN → FIN)
    if (divisionAbbr === deptCode) {
      return `${deptCode}-${year}-${seq}`;
    }
    return `${deptCode}-${divisionAbbr}-${year}-${seq}`;
  }

  /**
   * Set due time/allotted time for a file (Department Admin and Super Admin only)
   */
  async setFileDueTime(
    fileId: string,
    userId: string,
    userRoles: string[],
    allottedTimeInHours: number,
  ) {
    // Check authorization - Department Admin, Support, and Super Admin can set due time
    if (
      !userRoles.includes(UserRole.DEVELOPER) &&
      !userRoles.includes(UserRole.SUPER_ADMIN) &&
      !userRoles.includes(UserRole.SUPPORT) &&
      !userRoles.includes(UserRole.DEPT_ADMIN)
    ) {
      throw new ForbiddenException(
        'Only Department Admin, Support, or Super Admin can set due time for files',
      );
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { department: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Department Admin can only set due time for files in their department (Support and Super Admin can set any)
    if (
      userRoles.includes(UserRole.DEPT_ADMIN) &&
      !userRoles.includes(UserRole.DEVELOPER) &&
      !userRoles.includes(UserRole.SUPER_ADMIN) &&
      !userRoles.includes(UserRole.SUPPORT)
    ) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });

      if (user?.departmentId !== file.departmentId) {
        throw new ForbiddenException(
          'Department Admin can only set due time for files in their own department',
        );
      }
    }

    if (allottedTimeInHours <= 0) {
      throw new BadRequestException('Allotted time must be greater than 0');
    }

    const allottedTimeInSeconds = allottedTimeInHours * 3600; // Convert hours to seconds
    const now = new Date();
    const dueDate = new Date(now.getTime() + allottedTimeInSeconds * 1000);

    // Update file with due time
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        allottedTime: allottedTimeInSeconds,
        deskArrivalTime: file.deskArrivalTime || now, // Set arrival time if not already set
        deskDueDate: dueDate,
        dueDate: file.dueDate || dueDate, // Set overall due date if not already set
      },
    });

    // Recalculate timer
    await this.timing.updateTimeRemaining(fileId);

    // Create audit log
    await this.createAuditLog(
      fileId,
      userId,
      'due_time_set',
      `Due time set to ${allottedTimeInHours} hours by admin`,
    );

    return updatedFile;
  }

  async createAuditLog(
    fileId: string,
    userId: string,
    action: string,
    remarks: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entityType: 'File',
        entityId: fileId,
        userId,
        fileId,
        metadata: { remarks },
      },
    });
  }
}
