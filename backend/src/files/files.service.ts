import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { MinIOService } from '../minio/minio.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { TimingService } from '../timing/timing.service';
import { CapacityService } from '../capacity/capacity.service';
import { RbacService } from '../auth/rbac.service';
import { getDepartmentalScopeDepartmentIds } from '../auth/auth.helpers';
import {
  deptAdminInDepartmentWhere,
  departmentalRoleInDepartmentWhere,
} from '../auth/dept-admin-prisma';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FileStatus, FilePriority, FileAction, UserRole, FileAssignmentStatus } from '@prisma/client';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinIOService,
    private rabbitmq: RabbitMQService,
    private timing: TimingService,
    private capacityService: CapacityService,
    private rbac: RbacService,
    private workflowEngine: WorkflowEngineService,
    private notificationsService: NotificationsService,
  ) {}

  private rbacUserPayload(user: {
    id: string;
    roles?: string[];
    departmentId: string | null;
    divisionId: string | null;
    administeredDepartments?: { id: string }[];
  }) {
    return {
      userId: user.id,
      roles: user.roles ?? [],
      departmentId: user.departmentId,
      divisionId: user.divisionId,
      departmentalScopeDepartmentIds:
        user.roles?.includes('DEPT_ADMIN') || user.roles?.includes('APPROVAL_AUTHORITY')
        ? getDepartmentalScopeDepartmentIds(user)
        : undefined,
    };
  }

  /**
   * Export a full "packed" PDF of a file with:
   * - Cover page (file information)
   * - Notes with timestamps
   * - Attachments rendered as full pages where possible (PDFs/images)
   * Access: same as viewing the file (anyone who can getFileById can export).
   */
  async exportFilePdf(
    fileId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    let file: any;
    try {
      // Reuse existing RBAC: anyone who can view the file can export (no extra restriction)
      file = await this.getFileById(fileId, userId);
    } catch (e) {
      throw e;
    }

    try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    const lineHeight = 14;

    const addPageWithTitle = (title: string) => {
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      // Header
      page.drawText(title, {
        x: margin,
        y: height - margin,
        size: 18,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      page.drawLine({
        start: { x: margin, y: height - margin - 8 },
        end: { x: width - margin, y: height - margin - 8 },
        thickness: 1,
        color: rgb(0.2, 0.2, 0.2),
      });
      return { page, cursorY: height - margin - 24 };
    };

    const sanitize = (s: string) =>
      String(s ?? '')
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
        .slice(0, 10000);

    const writeWrapped = (
      page: any,
      text: string,
      cursorY: number,
      options?: { bold?: boolean; size?: number },
    ): { page: any; cursorY: number } => {
      const { width, height } = page.getSize();
      const maxWidth = width - margin * 2;
      const fontSize = options?.size ?? 11;
      const useFont = options?.bold ? fontBold : font;
      const safeText = sanitize(text);

      const words = safeText.split(/\s+/);
      let line = '';
      let y = cursorY;

      const flushLine = () => {
        if (!line) return;
        if (y < margin + lineHeight) {
          // new page
          const result = addPageWithTitle(''); // no title for continuation
          page = result.page;
          y = result.cursorY;
        }
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font: useFont,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
        line = '';
      };

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const w = useFont.widthOfTextAtSize(testLine, fontSize);
        if (w > maxWidth) {
          flushLine();
          line = word;
        } else {
          line = testLine;
        }
      }
      flushLine();
      return { page, cursorY: y - lineHeight / 2 };
    };

    // 1. Cover page with file information
    let { page: currentPage, cursorY } = addPageWithTitle('File Summary');

    const createdAt = file.createdAt
      ? new Date(file.createdAt).toLocaleString()
      : '';
    const assignedTo = file.assignedTo?.name || 'Not assigned';
    const department = file.department?.name || '';
    const division = file.currentDivision?.name || '';

    const infoLines = [
      `File Number: ${file.fileNumber}`,
      `Subject: ${file.subject || ''}`,
      `Status: ${file.status}`,
      `Department: ${department}`,
      division ? `Division: ${division}` : '',
      `Created By: ${file.createdBy?.name || ''}`,
      createdAt ? `Created At: ${createdAt}` : '',
      `Current Assignee: ${assignedTo}`,
      `Priority: ${file.priority || 'NORMAL'}`,
    ].filter(Boolean);

    infoLines.forEach((line) => {
      const res = writeWrapped(currentPage, line, cursorY, { bold: false });
      currentPage = res.page;
      cursorY = res.cursorY;
    });

    // File Matter (description)
    cursorY -= lineHeight;
    const matterTitle = 'File Matter';
    const matterHeader = writeWrapped(currentPage, matterTitle, cursorY, {
      bold: true,
      size: 13,
    });
    currentPage = matterHeader.page;
    cursorY = matterHeader.cursorY - lineHeight / 2;

    const fileMatter = String(file.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (fileMatter) {
      const matterRes = writeWrapped(currentPage, fileMatter, cursorY, { bold: false });
      currentPage = matterRes.page;
      cursorY = matterRes.cursorY;
    } else {
      const noMatter = writeWrapped(currentPage, 'No file matter provided.', cursorY, { bold: false });
      currentPage = noMatter.page;
      cursorY = noMatter.cursorY;
    }

    cursorY -= lineHeight;
    const notesTitle = 'Notes';
    const notesHeader = writeWrapped(currentPage, notesTitle, cursorY, {
      bold: true,
      size: 13,
    });
    currentPage = notesHeader.page;
    cursorY = notesHeader.cursorY - lineHeight / 2;

    // 2. Notes with timestamps
    const notes = (file.notes || []) as any[];
    if (notes.length === 0) {
      const res = writeWrapped(currentPage, 'No notes available.', cursorY);
      currentPage = res.page;
      cursorY = res.cursorY;
    } else {
      // Notes are already ordered by createdAt desc; reverse to oldest first for reading
      const orderedNotes = [...notes].reverse();
      for (const note of orderedNotes) {
        const ts = note.createdAt
          ? new Date(note.createdAt).toLocaleString()
          : '';
        const author = note.user?.name || '';
        const header = `[${ts}] ${author}`;
        let res = writeWrapped(currentPage, header, cursorY, {
          bold: true,
        });
        currentPage = res.page;
        cursorY = res.cursorY;

        const content = String(note.content ?? '').replace(/<[^>]+>/g, '');
        if (content.trim()) {
          res = writeWrapped(currentPage, content, cursorY, { bold: false });
          currentPage = res.page;
          cursorY = res.cursorY;
        }

        cursorY -= lineHeight; // spacing between notes
      }
    }

    // 3. Attachments overview
    const attachments = (file.attachments || []) as any[];
    if (attachments.length > 0) {
      const section = addPageWithTitle('Attachments');
      currentPage = section.page;
      cursorY = section.cursorY;

      attachments.forEach((att, index) => {
      const uploadedAt: string | null = att.createdAt
          ? new Date(att.createdAt).toLocaleString()
          : null;
        const uploader: string | null = att.uploadedBy?.name || null;
        const line = `${index + 1}. ${att.filename} (${att.mimeType || 'unknown'}, ${
          att.size ? `${Math.round(att.size / 1024)} KB` : 'size unknown'
        })`;
        let res = writeWrapped(currentPage, line, cursorY, { bold: true });
        currentPage = res.page;
        cursorY = res.cursorY;

        const metaParts: string[] = [];
        if (uploader) metaParts.push(`Uploaded by: ${uploader}`);
        if (uploadedAt) metaParts.push(`Uploaded at: ${uploadedAt}`);
        if (metaParts.length > 0) {
          res = writeWrapped(currentPage, metaParts.join(' | '), cursorY, {
            bold: false,
          });
          currentPage = res.page;
          cursorY = res.cursorY;
        }

        cursorY -= lineHeight;
      });
    }

    // Helper: add a separator page so readers can distinguish between attachments
    const addEndOfAttachmentPage = (attachmentName: string) => {
      const sepPage = pdfDoc.addPage();
      const { width, height } = sepPage.getSize();
      const label = `End of attachment: ${sanitize(attachmentName)}`;
      sepPage.drawText(label, {
        x: margin,
        y: height - margin,
        size: 12,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      sepPage.drawLine({
        start: { x: margin, y: height - margin - 6 },
        end: { x: width - margin, y: height - margin - 6 },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
      });
    };

    // 4. Attachments content as full pages – limit count and size to avoid 502/timeout
    const MAX_EMBED_PDFS = 3;
    const MAX_EMBED_IMAGES = 5;
    const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB per attachment
    let embeddedPdfs = 0;
    let embeddedImages = 0;

    for (const att of attachments) {
      if (!att.s3Key) continue;
      let buffer: Buffer;
      try {
        buffer = await this.minio.getFileBuffer(att.s3Key);
      } catch {
        continue;
      }
      if (buffer.length > MAX_ATTACHMENT_BYTES) continue;

      const mime = (att.mimeType || '').toLowerCase();
      const attName = att.filename || 'attachment';

      if (mime === 'application/pdf' || att.filename?.toLowerCase().endsWith('.pdf')) {
        if (embeddedPdfs >= MAX_EMBED_PDFS) continue;
        try {
          const srcDoc = await PDFDocument.load(buffer);
          const copiedPages = await pdfDoc.copyPages(
            srcDoc,
            srcDoc.getPageIndices(),
          );
          copiedPages.forEach((p) => pdfDoc.addPage(p));
          addEndOfAttachmentPage(attName);
          embeddedPdfs++;
        } catch {
          // skip
        }
        continue;
      }

      if (
        (mime.startsWith('image/') || att.filename?.match(/\.(png|jpg|jpeg|webp)$/i)) &&
        embeddedImages < MAX_EMBED_IMAGES
      ) {
        try {
          const page = pdfDoc.addPage();
          const { width, height } = page.getSize();
          let image;
          if (mime.includes('png') || att.filename?.toLowerCase().endsWith('.png')) {
            image = await pdfDoc.embedPng(buffer);
          } else {
            image = await pdfDoc.embedJpg(buffer);
          }
          const imgWidth = image.width;
          const imgHeight = image.height;
          const scale = Math.min(
            (width - margin * 2) / imgWidth,
            (height - margin * 2) / imgHeight,
          );
          const drawnWidth = imgWidth * scale;
          const drawnHeight = imgHeight * scale;
          const x = (width - drawnWidth) / 2;
          const y = (height - drawnHeight) / 2;
          page.drawImage(image, {
            x,
            y,
            width: drawnWidth,
            height: drawnHeight,
          });
          addEndOfAttachmentPage(attName);
          embeddedImages++;
        } catch {
          // skip
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    const safeNumber = (file.fileNumber || file.id || 'file').replace(
      /[^a-zA-Z0-9-_]/g,
      '_',
    );

    return {
      buffer: Buffer.from(pdfBytes),
      filename: `${safeNumber}.pdf`,
      mimeType: 'application/pdf',
    };
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof ForbiddenException ||
        e instanceof BadRequestException
      ) {
        throw e;
      }
      throw new InternalServerErrorException(
        e instanceof Error ? e.message : 'PDF export failed',
      );
    }
  }

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
    if (!data.subject?.trim()) {
      throw new BadRequestException('Subject is required');
    }
    if (!data.departmentId) {
      throw new BadRequestException('Department is required');
    }
    // Permission check: INWARD_DESK and DISPATCHER cannot create new files
    const user = await this.prisma.user.findUnique({
      where: { id: data.createdById },
      select: { roles: true },
    });

    const isInwardDeskOnly = user?.roles?.includes('INWARD_DESK') && !user?.roles?.includes('DEPT_ADMIN') && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes('DEVELOPER');
    const isDispatcherOnly = user?.roles?.includes('DISPATCHER') && !user?.roles?.includes('DEPT_ADMIN') && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes('DEVELOPER');
    if (isInwardDeskOnly || isDispatcherOnly) {
      throw new ForbiddenException('Inward Desk and Dispatch users cannot create new files. They can only view files in their inbox and forward them.');
    }

    // Generate file number; retry on unique constraint (race with concurrent creates)
    let fileNumber = await this.generateFileNumber(
      data.departmentId,
      data.divisionId,
    );
    const maxAttempts = 10;
    let file: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        file = await this.prisma.file.create({
          data: {
            fileNumber,
            subject: data.subject,
            description: data.description,
            departmentId: data.departmentId,
            currentDivisionId: data.divisionId,
            createdById: data.createdById,
            originDepartmentId: data.departmentId,
            assignedToId: data.createdById,
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
        break;
      } catch (err: any) {
        const isUniqueViolation = err?.code === 'P2002' && (Array.isArray(err?.meta?.target) ? err.meta.target.includes('fileNumber') : err?.meta?.target === 'fileNumber');
        if (isUniqueViolation && attempt < maxAttempts) {
          fileNumber = await this.generateFileNumber(data.departmentId, data.divisionId, attempt);
          continue;
        }
        throw err;
      }
    }

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

    // Timer starts on forward, not on create. Only update if explicit dueDate was passed.
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

    // Start department default workflow if set (workflow-driven routing).
    // We create the workflow execution at the start node but do NOT
    // auto-assign the file to the first task node here. The creator
    // keeps control until they explicitly approve/forward.
    const department = await this.prisma.department.findUnique({
      where: { id: file.departmentId },
      include: { defaultWorkflow: true },
    });
    if (
      department?.defaultWorkflowId &&
      department.defaultWorkflow?.isActive
    ) {
      try {
        await this.workflowEngine.startWorkflow(
          department.defaultWorkflowId,
          file.id,
        );
      } catch {
        // If workflow start fails, file remains without execution (fallback to manual routing)
      }
    }

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
      select: { id: true, originDepartmentId: true },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true, departmentId: true },
    });

    const isHostDepartment =
      file.originDepartmentId &&
      user?.departmentId &&
      file.originDepartmentId === user.departmentId;

    const roles = user?.roles ?? [];
    const isDispatcherOnly =
      roles.includes('DISPATCHER') &&
      !roles.includes('DEPT_ADMIN') &&
      !roles.includes('SUPER_ADMIN') &&
      !roles.includes('DEVELOPER');

    if (!isHostDepartment && isDispatcherOnly) {
      throw new ForbiddenException(
        'Dispatch users cannot add attachments to files.',
      );
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
      include: { file: { select: { id: true, originDepartmentId: true } } },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true, departmentId: true },
    });

    const isHostDepartment =
      attachment.file.originDepartmentId &&
      user?.departmentId &&
      attachment.file.originDepartmentId === user.departmentId;

    const roles = user?.roles ?? [];
    const isDispatcherOnly =
      roles.includes('DISPATCHER') &&
      !roles.includes('DEPT_ADMIN') &&
      !roles.includes('SUPER_ADMIN') &&
      !roles.includes('DEVELOPER');

    if (!isHostDepartment && isDispatcherOnly) {
      throw new ForbiddenException(
        'Dispatch users cannot delete attachments from files.',
      );
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

  /** Returns full buffer for reliable preview (no stream conversion issues). */
  async getAttachmentBuffer(attachmentId: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    const buffer = await this.minio.getFileBuffer(attachment.s3Key);
    return {
      buffer,
      filename: attachment.filename,
      mimeType: attachment.mimeType || 'application/octet-stream',
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
      /** When true, return only files originated by the host department (Rule 9). */
      originated?: boolean;
      /** When true, return only red-listed files (e.g. from Home/Dashboard "Red Listed" link). */
      redlisted?: boolean;
      /** When true, return only files assigned to the current user (e.g. Pending Approvals for Approval Authority). */
      assignedToMe?: boolean;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    // Get user's division ID for proper RBAC
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roles: true,
        departmentId: true,
        divisionId: true,
        administeredDepartments: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build RBAC filter
    const accessFilter = this.rbac.buildFileAccessFilter(this.rbacUserPayload(user));

    const where: any = { ...accessFilter.where };

    // Originated files: only files initiated by the host department (Rule 9)
    if (options?.originated) {
      const deptScope = getDepartmentalScopeDepartmentIds(user);
      if (deptScope.length > 0) {
        where.originDepartmentId = { in: deptScope };
      } else if (user.departmentId) {
        where.originDepartmentId = user.departmentId;
      }
    }

    // Red-listed filter (e.g. Home > Red Listed)
    if (options?.redlisted) {
      where.isRedListed = true;
    }

    // Assigned to me (e.g. Pending Approvals)
    if (options?.assignedToMe) {
      where.assignedToId = user.id;
    }

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

  /** Files forwarded/sent by the current user (from their desk), similar to Sent Mail */
  async getSentFiles(
    userId: string,
    userRoles: string[],
    departmentId?: string | null,
    options?: {
      status?: string;
      priority?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roles: true,
        departmentId: true,
        divisionId: true,
        administeredDepartments: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accessFilter = this.rbac.buildFileAccessFilter(this.rbacUserPayload(user));

    // File IDs where user was the forwarder (fromUserId in FileRouting)
    const sentRouting = await this.prisma.fileRouting.findMany({
      where: {
        fromUserId: userId,
        action: { in: ['FORWARDED', 'APPROVED', 'DISPATCHED', 'OPINION_REQUESTED', 'CONSULTATION_SENT'] },
      },
      select: { fileId: true },
      distinct: ['fileId'],
      orderBy: { createdAt: 'desc' },
    });
    const sentFileIds = sentRouting.map((r) => r.fileId);
    if (sentFileIds.length === 0) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where: any = {
      id: { in: sentFileIds },
      ...accessFilter.where,
    };

    // Dispatcher's RBAC adds status=APPROVED, but sent files become IN_PROGRESS after
    // forward. For Sent Files view, allow any status so Dispatcher can see what they sent.
    const isDispatcher =
      userRoles.includes('DISPATCHER') &&
      !userRoles.includes('DEPT_ADMIN') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER');
    if (isDispatcher && where.AND) {
      where.AND = where.AND.filter((c: any) => c.status !== 'APPROVED');
      if (where.AND.length === 0) delete where.AND;
    }

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.priority) {
      where.priority = options.priority;
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { fileNumber: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
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
      select: {
        id: true,
        roles: true,
        departmentId: true,
        divisionId: true,
        administeredDepartments: { select: { id: true } },
      },
    });

    if (!user) {
      return [];
    }

    // Build RBAC filter
    const accessFilter = this.rbac.buildFileAccessFilter(this.rbacUserPayload(user));

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
            processCycle: { select: { id: true, cycleNumber: true, closedAt: true } },
            department: { select: { id: true, name: true, code: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        routingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            toUser: { select: { id: true, name: true, department: { select: { name: true } } } },
          },
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
        fileAssignments: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
          include: {
            toUser: {
              select: {
                id: true,
                name: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
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
        administeredDepartments: { select: { id: true } },
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
        originDepartmentId: file.originDepartmentId ?? undefined,
      },
      this.rbacUserPayload(user),
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

    const adminScope = getDepartmentalScopeDepartmentIds(user);
    const isPureDepartmentalScopedRole =
      (userRoles.includes('DEPT_ADMIN') || userRoles.includes('APPROVAL_AUTHORITY')) &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER');

    // Filter notes: Host department sees ALL notes (all tasks + all notes). Other departments see only notes assigned to them (their task + their own notes).
    const isHostDepartment = !!(
      file.originDepartmentId &&
      (isPureDepartmentalScopedRole && adminScope.length > 0
        ? adminScope.includes(file.originDepartmentId)
        : !!(user.departmentId && file.originDepartmentId === user.departmentId))
    );
    let filteredNotes = file.notes;
    if (isHostDepartment) {
      filteredNotes = file.notes; // Host sees everything
    } else if (isPureDepartmentalScopedRole && adminScope.length > 0) {
      filteredNotes = file.notes.filter(
        (n: any) => n.departmentId && adminScope.includes(n.departmentId),
      );
    } else if (user.departmentId) {
      filteredNotes = file.notes.filter(
        (n: any) => n.departmentId === user.departmentId,
      );
    }

    // Further restriction: non-host INWARD_DESK on external file sees only latest note (routing assist)
    const fileOutsideUserDept =
      isPureDepartmentalScopedRole && adminScope.length > 0
        ? !adminScope.includes(file.departmentId)
        : file.departmentId !== user.departmentId;
    if (!isHostDepartment && isInwardDesk && fileOutsideUserDept) {
      filteredNotes = filteredNotes.slice(0, 1);
    }

    // Build note log grouped by process cycle then by department (E-File rules 4 & 5)
    const cycleMap = new Map<string | null, { cycleNumber: number; closedAt: Date | null; deptMap: Map<string, { departmentName: string; notes: typeof filteredNotes }> }>();
    for (const note of filteredNotes) {
      const cycleId = (note as any).processCycleId ?? null;
      const cycle = (note as any).processCycle as { cycleNumber: number; closedAt: Date | null } | null;
      const deptId = (note as any).departmentId ?? '__none__';
      const dept = (note as any).department as { name: string } | null;
      if (!cycleMap.has(cycleId)) {
        cycleMap.set(cycleId, {
          cycleNumber: cycle?.cycleNumber ?? 0,
          closedAt: cycle?.closedAt ?? null,
          deptMap: new Map(),
        });
      }
      const entry = cycleMap.get(cycleId)!;
      if (!entry.deptMap.has(deptId)) {
        entry.deptMap.set(deptId, { departmentName: dept?.name ?? '—', notes: [] });
      }
      entry.deptMap.get(deptId)!.notes.push(note);
    }
    const noteLogGrouped = Array.from(cycleMap.entries())
      .sort((a, b) => (a[1].cycleNumber - b[1].cycleNumber))
      .map(([cycleId, v]) => ({
        processCycleId: cycleId,
        cycleNumber: v.cycleNumber,
        closedAt: v.closedAt,
        notesByDepartment: Array.from(v.deptMap.entries()).map(([deptId, d]) => ({
          departmentId: deptId === '__none__' ? null : deptId,
          departmentName: d.departmentName,
          notes: d.notes,
        })),
      }));

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
      noteLogGrouped, // Notes grouped by process cycle then by department (for UI)
      fileUrl: file.s3Key
        ? `/files/attachments/legacy/download?key=${encodeURIComponent(file.s3Key)}`
        : null,
      attachments: attachmentsWithUrls,
    };
  }

  /**
   * Get or create the current process cycle for this file when forwarding.
   * A new cycle is opened when the host department sends the file out (or after previous cycle was closed).
   */
  private async getOrCreateProcessCycle(
    fileId: string,
    file: { originDepartmentId: string | null; currentProcessCycleId: string | null },
    fromUser: { departmentId: string | null },
  ): Promise<string> {
    const isLeavingHost =
      file.originDepartmentId && fromUser.departmentId && file.originDepartmentId === fromUser.departmentId;
    const currentCycle = file.currentProcessCycleId
      ? await this.prisma.processCycle.findUnique({
          where: { id: file.currentProcessCycleId },
          select: { id: true, closedAt: true },
        })
      : null;
    const openCycle = currentCycle && !currentCycle.closedAt ? currentCycle.id : null;

    if (isLeavingHost && !openCycle) {
      const maxCycle = await this.prisma.processCycle
        .aggregate({ where: { fileId }, _max: { cycleNumber: true } })
        .then((r) => r._max.cycleNumber ?? 0);
      const newCycle = await this.prisma.processCycle.create({
        data: { fileId, cycleNumber: maxCycle + 1 },
        select: { id: true },
      });
      await this.prisma.file.update({
        where: { id: fileId },
        data: { currentProcessCycleId: newCycle.id },
      });
      return newCycle.id;
    }
    if (openCycle) return openCycle;
    const fallback = await this.prisma.processCycle.findFirst({
      where: { fileId },
      orderBy: { cycleNumber: 'desc' },
      select: { id: true },
    });
    if (fallback) return fallback.id;
    const created = await this.prisma.processCycle.create({
      data: { fileId, cycleNumber: 1 },
      select: { id: true },
    });
    await this.prisma.file.update({
      where: { id: fileId },
      data: { currentProcessCycleId: created.id },
    });
    return created.id;
  }

  /**
   * Resolve one recipient (toDepartmentId, toDivisionId, toUserId) to concrete finalToUserId and finalToDivisionId.
   */
  private async resolveRecipient(
    fromUser: { roles: string[]; departmentId: string | null },
    toDepartmentId?: string,
    toDivisionId?: string,
    toUserId?: string | null,
  ): Promise<{ finalToUserId: string; finalToDivisionId: string }> {
    const userRoles = fromUser.roles ?? [];
    const isDispatcher = userRoles.includes('DISPATCHER') && !userRoles.includes('DEPT_ADMIN');
    const isRestrictedRole =
      (userRoles.includes('INWARD_DESK') || userRoles.includes('SECTION_OFFICER')) && !userRoles.includes('DEPT_ADMIN');

    let finalToUserId: string | null = toUserId ?? null;
    let finalToDivisionId: string | undefined = toDivisionId;

    if (isDispatcher) {
      if (!toDepartmentId) throw new BadRequestException('Please select a department to forward the file');
      const inwardDeskUser = await this.prisma.user.findFirst({
        where: { departmentId: toDepartmentId, roles: { has: 'INWARD_DESK' }, isActive: true },
        include: { division: { select: { id: true } } },
        orderBy: { createdAt: 'asc' },
      });
      if (!inwardDeskUser)
        throw new NotFoundException('No inward desk user found in the target department.');
      finalToUserId = inwardDeskUser.id;
      finalToDivisionId = inwardDeskUser.division?.id ?? (
        await this.prisma.division.findFirst({
          where: { departmentId: toDepartmentId },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })
      )?.id;
    } else if (isRestrictedRole && fromUser.departmentId) {
      if (!toDivisionId) throw new BadRequestException('Please select a division to forward the file');
      const toDivision = await this.prisma.division.findUnique({
        where: { id: toDivisionId },
        select: { departmentId: true },
      });
      if (!toDivision || toDivision.departmentId !== fromUser.departmentId)
        throw new ForbiddenException('You can only forward files to divisions within your own department.');
      const isInwardDeskSender = userRoles.includes('INWARD_DESK');
      if (isInwardDeskSender && toUserId) {
        const targetUser = await this.prisma.user.findUnique({
          where: { id: toUserId },
          select: { roles: true, departmentId: true },
        });
        if (!targetUser) throw new NotFoundException('Recipient user not found');
        if (targetUser.departmentId !== fromUser.departmentId)
          throw new ForbiddenException('Inward Desk can only forward to users within their own department.');
        const targetRoles = targetUser.roles ?? [];
        if (!targetRoles.includes('SECTION_OFFICER') && !targetRoles.includes('DEPT_ADMIN'))
          throw new ForbiddenException('Inward Desk can only forward to Section Officer or Department Admin.');
        finalToUserId = toUserId;
        finalToDivisionId = toDivisionId;
      } else {
        const inwardDeskUser = await this.prisma.user.findFirst({
          where: { divisionId: toDivisionId, roles: { has: 'INWARD_DESK' }, isActive: true },
          select: { id: true },
        });
        if (!inwardDeskUser) throw new NotFoundException('No inward desk user found for division.');
        finalToUserId = inwardDeskUser.id;
        finalToDivisionId = toDivisionId;
      }
    } else if (!isDispatcher && !isRestrictedRole && toDepartmentId) {
      if (toDepartmentId === fromUser.departmentId)
        throw new BadRequestException('Use Inside Department to forward within your department.');
      const inwardDeskUser = await this.prisma.user.findFirst({
        where: { departmentId: toDepartmentId, roles: { has: 'INWARD_DESK' }, isActive: true },
        include: { division: { select: { id: true } } },
        orderBy: { createdAt: 'asc' },
      });
      if (!inwardDeskUser) throw new NotFoundException('No inward desk user found in the target department.');
      finalToUserId = inwardDeskUser.id;
      finalToDivisionId =
        inwardDeskUser.division?.id ??
        (await this.prisma.division.findFirst({
          where: { departmentId: toDepartmentId },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        }))?.id ??
        undefined;
    } else if (!isDispatcher && !isRestrictedRole && toDivisionId) {
      const toDivision = await this.prisma.division.findUnique({
        where: { id: toDivisionId },
        select: { departmentId: true },
      });
      if (!toDivision || toDivision.departmentId !== fromUser.departmentId)
        throw new ForbiddenException('You can only forward to divisions within your own department when using Inside Department.');
      const inwardDeskUser = await this.prisma.user.findFirst({
        where: { divisionId: toDivisionId, roles: { has: 'INWARD_DESK' }, isActive: true },
        select: { id: true },
      });
      if (!inwardDeskUser) throw new NotFoundException('No inward desk user found for division.');
      finalToUserId = inwardDeskUser.id;
      finalToDivisionId = toDivisionId;
    }

    if (!finalToUserId || !finalToDivisionId)
      throw new BadRequestException('Recipient user and division are required');
    return { finalToUserId, finalToDivisionId };
  }

  async forwardFile(
    fileId: string,
    fromUserId: string,
    toDivisionId: string | undefined,
    toDepartmentId: string | undefined, // For dispatcher forwarding to other departments
    toUserId: string | null, // Can be null for internal forwarding (auto-assign to inward desk)
    remarks?: string,
    recipients?: Array<{ toDepartmentId?: string; toDivisionId?: string; toUserId?: string | null; remarks?: string }>,
    submitToSectionOfficer?: boolean, // Inward Desk Submit: auto-forward to Section Officer (workflow next)
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
    const isDispatcher =
      userRoles.includes('DISPATCHER') && !userRoles.includes('DEPT_ADMIN');
    const isRestrictedRole =
      (userRoles.includes('INWARD_DESK') ||
        userRoles.includes('SECTION_OFFICER')) &&
      !userRoles.includes('DEPT_ADMIN');
    const isSectionOfficerOnly =
      userRoles.includes('SECTION_OFFICER') &&
      !userRoles.includes('INWARD_DESK') &&
      !userRoles.includes('DEPT_ADMIN') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER');

    // For pure Section Officers, use workflow (approveAndForward) only when they
    // are not choosing a recipient (e.g. a "Submit to next" action). When they use
    // the Forward modal and select a department/division/user, honour that and
    // run the normal forward so it works even when no workflow is configured.
    const hasExplicitRecipient =
      toDepartmentId != null ||
      toDivisionId != null ||
      toUserId != null ||
      (recipients != null && recipients.length > 0);
    if (isSectionOfficerOnly && !hasExplicitRecipient) {
      return this.approveAndForward(fileId, fromUserId, remarks);
    }

    const isInwardDeskOnly =
      userRoles.includes('INWARD_DESK') &&
      !userRoles.includes('DEPT_ADMIN') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER');

    // Build resolved recipient list: multi-forward (recipients array), single, or Inward Desk Submit (auto Section Officer)
    type Resolved = { finalToUserId: string; finalToDivisionId: string; remarks?: string };
    let resolvedList: Resolved[] = [];

    if (isInwardDeskOnly && submitToSectionOfficer && !recipients?.length && fromUser.departmentId) {
      // Inward Desk Submit: auto-forward to Section Officer in same department (next in workflow)
      const sectionOfficer = await this.prisma.user.findFirst({
        where: {
          departmentId: fromUser.departmentId,
          roles: { has: 'SECTION_OFFICER' },
          isActive: true,
        },
        include: { division: { select: { id: true } } },
        orderBy: { createdAt: 'asc' },
      });
      if (!sectionOfficer) {
        throw new NotFoundException(
          'No Section Officer found in your department. Cannot submit. Use Forward to choose a recipient.',
        );
      }
      const soDivisionId = sectionOfficer.division?.id ?? (
        await this.prisma.division.findFirst({
          where: { departmentId: fromUser.departmentId },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })
      )?.id;
      if (!soDivisionId) {
        throw new NotFoundException('No division found in your department.');
      }
      resolvedList = [{ finalToUserId: sectionOfficer.id, finalToDivisionId: soDivisionId, remarks }];
    } else if (recipients?.length) {
      for (const r of recipients) {
        const resolved = await this.resolveRecipient(
          fromUser,
          r.toDepartmentId,
          r.toDivisionId,
          r.toUserId ?? null,
        );
        resolvedList.push({ ...resolved, remarks: r.remarks });
      }
    } else {
      const resolved = await this.resolveRecipient(fromUser, toDepartmentId, toDivisionId, toUserId);
      resolvedList.push({ ...resolved, remarks });
    }
    if (resolvedList.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    // Multi-forward: create parallel FileRouting + FileAssignment per recipient
    if (resolvedList.length > 1) {
      await this.prisma.fileAssignment.updateMany({
        where: { fileId, toUserId: fromUserId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        data: { status: FileAssignmentStatus.CLOSED },
      });
      const processCycleId = await this.getOrCreateProcessCycle(fileId, file, fromUser);
      const first = resolvedList[0];
      for (const r of resolvedList) {
        const toUser = await this.prisma.user.findUnique({
          where: { id: r.finalToUserId },
          select: { departmentId: true, name: true, department: { select: { name: true } } },
        });
        const toDepartmentId = toUser?.departmentId ?? file.departmentId;
        const defaultRemarksMulti =
          toUser?.department?.name != null
            ? `Forwarded to ${toUser.department.name}`
            : toUser?.name
              ? `Forwarded to ${toUser.name}`
              : 'Forwarded';
        const routing = await this.prisma.fileRouting.create({
          data: {
            fileId,
            fromUserId,
            toUserId: r.finalToUserId,
            toDivisionId: r.finalToDivisionId,
            toDepartmentId: toDepartmentId,
            action: FileAction.FORWARDED,
            actionString: 'forward',
            remarks: (r.remarks?.trim() || defaultRemarksMulti),
            processCycleId,
          },
        });
        await this.prisma.fileAssignment.create({
          data: {
            fileId,
            processCycleId,
            fileRoutingId: routing.id,
            toDepartmentId,
            toDivisionId: r.finalToDivisionId,
            toUserId: r.finalToUserId,
            status: FileAssignmentStatus.IN_PROGRESS,
          },
        });
        // Task per department: store as Note with dept name so host can differentiate (only that dept + host see it)
        if (r.remarks?.trim()) {
          const toDept = await this.prisma.department.findUnique({
            where: { id: toDepartmentId },
            select: { name: true },
          });
          const deptName = toDept?.name ?? 'Unknown';
          await this.prisma.note.create({
            data: {
              fileId,
              userId: fromUserId,
              content: `Task for ${deptName}: ${r.remarks.trim()}`,
              departmentId: toDepartmentId,
              processCycleId,
            },
          });
        }
      }
      const assignedUser = await this.prisma.user.findUnique({
        where: { id: first.finalToUserId },
        select: { divisionId: true, departmentId: true },
      });
      let isQueued = false;
      try {
        const capacity = await this.capacityService.getUserCapacity(first.finalToUserId);
        if (capacity.currentFileCount >= capacity.maxFilesPerDay) isQueued = true;
      } catch { /* ignore */ }
      const now = new Date();
      let allottedTimeInSeconds: number | null = null;
      let deskDueDate: Date | null = null;
      let deskId: string | null = null;
      if (assignedUser) {
        const orConditions: any[] = [];
        if (assignedUser.divisionId) orConditions.push({ divisionId: assignedUser.divisionId });
        if (assignedUser.departmentId) orConditions.push({ departmentId: assignedUser.departmentId });
        const desk = await this.prisma.desk.findFirst({
          where: { isActive: true, ...(orConditions.length ? { OR: orConditions } : {}) },
          select: { id: true, slaNorm: true },
          orderBy: { createdAt: 'asc' },
        });
        const defaultSetting = await this.prisma.systemSettings.findFirst({
          where: { key: 'defaultSlaNormHours', OR: [{ departmentId: file.departmentId }, { departmentId: null }] },
          orderBy: { departmentId: 'desc' },
          select: { value: true },
        }).catch(() => null);
        const defaultHours = defaultSetting ? parseInt(defaultSetting.value, 10) : 48;
        const slaHours = desk?.slaNorm ?? (Number.isNaN(defaultHours) ? 48 : defaultHours);
        if (desk?.id) deskId = desk.id;
        allottedTimeInSeconds = slaHours * 3600;
        deskDueDate = new Date(now.getTime() + allottedTimeInSeconds * 1000);
      }
      // Multi-forward: do not set a single assignee so all departments can work in parallel
      const recipient = await this.prisma.user.findFirst({
        where: { id: first.finalToUserId },
        select: { roles: true },
      });
      const isSendingToInwardDesk = recipient?.roles?.includes('INWARD_DESK') ?? false;
      const setIntended = isSendingToInwardDesk && (isDispatcher || isRestrictedRole || !!toDepartmentId || !!toDivisionId);
      const updatedFile = await this.prisma.file.update({
        where: { id: fileId },
        data: {
          assignedToId: null,
          currentDivisionId: null,
          status: FileStatus.IN_PROGRESS,
          isInQueue: false,
          deskId: null,
          deskArrivalTime: null,
          allottedTime: null,
          deskDueDate: null,
          intendedDivisionId: setIntended ? (toDivisionId ?? null) : null,
          intendedUserId: setIntended ? (toUserId ?? null) : null,
        },
      });
      if (allottedTimeInSeconds != null) await this.timing.updateTimeRemaining(fileId);
      if (isQueued) {
        const nextOrder = (await this.prisma.forwardQueue.aggregate({ where: { toUserId: first.finalToUserId }, _max: { sortOrder: true } }).then((r) => (r._max?.sortOrder ?? 0) + 1)) ?? 1;
        await this.prisma.forwardQueue.create({
          data: { fileId, toUserId: first.finalToUserId, toDivisionId: first.finalToDivisionId, fromUserId, remarks: first.remarks, sortOrder: nextOrder },
        });
      }
      await this.createAuditLog(fileId, fromUserId, 'forward', 'File forwarded to multiple recipients');
      for (const r of resolvedList) {
        await this.rabbitmq.publishToast({
          userId: r.finalToUserId,
          type: 'file_received',
          title: 'New File Assigned',
          message: `File ${file.fileNumber}: ${file.subject}`,
          fileId: file.id,
        });
        await this.notificationsService.createNotification({
          userId: r.finalToUserId,
          type: 'file_received',
          title: 'New File Assigned',
          message: `File ${file.fileNumber}: ${file.subject}`,
          fileId: file.id,
          priority: file.isRedListed ? 'urgent' : 'normal',
          actionRequired: true,
          actionType: 'open_file',
          metadata: { link: `/files/${file.id}` },
        });
      }
      await this.processQueueForUser(fromUserId);
      return updatedFile;
    }

    // Single recipient path (resolvedList has at least one entry)
    const firstResolved = resolvedList[0]!;
    const finalToUserId: string = firstResolved.finalToUserId;
    const finalToDivisionId: string = firstResolved.finalToDivisionId;
    const singleRemarks = firstResolved.remarks;

    // Close sender's file assignments (they have forwarded)
    await this.prisma.fileAssignment.updateMany({
      where: { fileId, toUserId: fromUserId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: { status: FileAssignmentStatus.CLOSED },
    });
    const processCycleId = await this.getOrCreateProcessCycle(fileId, file, fromUser);

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
        .then((r) => (r._max?.sortOrder ?? 0) + 1))
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

      // Use desk SLA norm, or default from system settings (department-specific then global)
      const defaultSetting = await this.prisma.systemSettings
        .findFirst({
          where: {
            key: 'defaultSlaNormHours',
            OR: [
              ...(file.departmentId ? [{ departmentId: file.departmentId }] : []),
              { departmentId: null },
            ],
          },
          orderBy: { departmentId: 'desc' }, // department-specific first, then global
          select: { value: true },
        })
        .catch(() => null);
      const defaultSlaHours = defaultSetting ? parseInt(defaultSetting.value, 10) : 48;
      const slaHours = desk?.slaNorm ?? (Number.isNaN(defaultSlaHours) ? 48 : defaultSlaHours);
      if (desk?.id) deskId = desk.id;
      allottedTimeInSeconds = slaHours * 3600; // Convert hours to seconds
      deskDueDate = new Date(now.getTime() + allottedTimeInSeconds * 1000);
    }

    const toUserDept = await this.prisma.user.findUnique({
      where: { id: finalToUserId },
      select: { name: true, departmentId: true, department: { select: { name: true } } },
    });
    const defaultRemarks =
      toUserDept?.department?.name != null
        ? `Forwarded to ${toUserDept.department.name}`
        : toUserDept?.name
          ? `Forwarded to ${toUserDept.name}`
          : 'Forwarded';
    const routing = await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId,
        toUserId: finalToUserId,
        toDivisionId: finalToDivisionId,
        toDepartmentId: toUserDept?.departmentId ?? undefined,
        action: FileAction.FORWARDED,
        actionString: 'forward',
        remarks: (singleRemarks?.trim() || defaultRemarks),
        processCycleId,
      },
    });
    await this.prisma.fileAssignment.create({
      data: {
        fileId,
        processCycleId,
        fileRoutingId: routing.id,
        toDepartmentId: toUserDept?.departmentId ?? file.departmentId,
        toDivisionId: finalToDivisionId,
        toUserId: finalToUserId,
        status: FileAssignmentStatus.IN_PROGRESS,
      },
    });

    // When multiple departments have active assignments, do not set a single assignee so all can work in parallel
    const activeCount = await this.prisma.fileAssignment.count({
      where: { fileId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    const multiAssignment = activeCount > 1;
    // When forwarding to another department (single forward), update file.departmentId so that
    // workflow resolution uses the current department (e.g. Finance section officer gets Finance's workflow).
    const targetDeptId = toUserDept?.departmentId ?? null;
    const shouldUpdateDepartment =
      !multiAssignment &&
      targetDeptId &&
      targetDeptId !== file.departmentId;

    // When the file moves to another department, close any running workflow execution from the
    // previous department so Submit in the new department uses that department's workflow.
    if (shouldUpdateDepartment) {
      await this.prisma.workflowExecution.updateMany({
        where: { fileId, status: 'running' },
        data: { status: 'completed', completedAt: new Date() },
      });
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        assignedToId: multiAssignment ? null : finalToUserId,
        currentDivisionId: multiAssignment ? null : finalToDivisionId,
        status: FileStatus.IN_PROGRESS,
        isInQueue: isQueued,
        ...(shouldUpdateDepartment ? { departmentId: targetDeptId } : {}),
        ...(!multiAssignment && deskId ? { deskId } : {}),
        deskArrivalTime: multiAssignment ? null : now,
        ...(!multiAssignment && allottedTimeInSeconds !== null ? {
          allottedTime: allottedTimeInSeconds,
          deskDueDate: deskDueDate,
        } : {}),
        intendedDivisionId,
        intendedUserId,
      },
    });

    // Recalculate timer if allotted time was set (single assignee only)
    if (!multiAssignment && allottedTimeInSeconds !== null) {
      await this.timing.updateTimeRemaining(fileId);
    }

    if (isQueued) {
      await this.prisma.forwardQueue.create({
        data: {
          fileId,
          toUserId: finalToUserId,
          toDivisionId: finalToDivisionId,
          fromUserId: fromUserId,
          remarks: singleRemarks ?? undefined,
          sortOrder: nextOrder,
        },
      });
    }

    // Task for this department: store as Note with dept name so host can differentiate
    if (singleRemarks?.trim()) {
      const deptName = toUserDept?.department?.name ?? 'Unknown';
      await this.prisma.note.create({
        data: {
          fileId,
          userId: fromUserId,
          content: `Task for ${deptName}: ${singleRemarks.trim()}`,
          departmentId: toUserDept?.departmentId ?? undefined,
          processCycleId,
        },
      });
    }

    await this.createAuditLog(
      fileId,
      fromUserId,
      'forward',
      singleRemarks || (isQueued ? 'File forwarded (queued)' : 'File forwarded'),
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
        await this.notificationsService.createNotification({
          userId: finalToUserId,
          type: 'file_received',
          title: 'New File Assigned',
          message: `File ${file.fileNumber}: ${file.subject}`,
          fileId: file.id,
          priority: file.isRedListed ? 'urgent' : 'normal',
          actionRequired: true,
          actionType: 'open_file',
          metadata: { link: `/files/${file.id}` },
        });
      } else {
        await this.rabbitmq.publishToast({
          userId: finalToUserId,
          type: 'file_received',
          title: 'File Queued',
          message: `File ${file.fileNumber} is in your queue (desk at capacity). It will move to your inbox when you have space.`,
          fileId: file.id,
        });
        await this.notificationsService.createNotification({
          userId: finalToUserId,
          type: 'file_queued',
          title: 'File Queued',
          message: `File ${file.fileNumber} is queued and will enter your inbox when capacity is free.`,
          fileId: file.id,
          priority: 'normal',
          actionRequired: true,
          actionType: 'open_file',
          metadata: { link: `/files/${file.id}` },
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
      include: { division: true, administeredDepartments: { select: { id: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRoles = (user.roles ?? []) as string[];
    const isSectionOfficer =
      userRoles.includes('SECTION_OFFICER') &&
      !userRoles.includes('DEPT_ADMIN') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER');
    const isDeptAdmin =
      userRoles.includes('DEPT_ADMIN') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER');
    const isApprovalAuthority =
      userRoles.includes('APPROVAL_AUTHORITY') &&
      !userRoles.includes('SUPER_ADMIN') &&
      !userRoles.includes('DEVELOPER');

    if (!isSectionOfficer && !isDeptAdmin && !isApprovalAuthority) {
      throw new ForbiddenException(
        'Only Section Officers, Department Admins and Approval Authorities can use approve and forward',
      );
    }

    // Route strictly by the file's current department context.
    const routingDepartmentId = file.departmentId ?? user.departmentId;

    /**
     * Universal hardcoded shortcut (1):
     * If a Section Officer CREATED the file and clicks submit, we skip the
     * workflow's initial "start → inward desk" hop and send directly to the
     * Department Admin in the same department.
     */
    if (isSectionOfficer && file.createdById === userId && routingDepartmentId) {
      const targetUser = await this.prisma.user.findFirst({
        where: {
          ...deptAdminInDepartmentWhere(routingDepartmentId),
          isActive: true,
        },
        include: { division: true },
      });

      if (!targetUser) {
        throw new NotFoundException(
          'No Department Admin found for this department. Please ensure a Department Admin is assigned.',
        );
      }

      // Assign to Dept Admin, keep file in progress
      const targetDivisionId = targetUser.divisionId ?? file.currentDivisionId;

      const forwardedFile = await this.prisma.file.update({
        where: { id: fileId },
        data: {
          assignedToId: targetUser.id,
          currentDivisionId: targetDivisionId,
          status: FileStatus.IN_PROGRESS,
        },
      });

      await this.prisma.fileRouting.create({
        data: {
          fileId,
          fromUserId: userId,
          toUserId: targetUser.id,
          toDivisionId: targetDivisionId,
          action: FileAction.FORWARDED,
          actionString: 'forward',
          remarks: remarks || `Submitted by Section Officer to Department Admin`,
        },
      });

      await this.createAuditLog(
        fileId,
        userId,
        'forward',
        remarks || `Section Officer submitted file to Department Admin`,
      );

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

      return {
        file: forwardedFile,
        approvedBy: user.name,
        forwardedTo: targetUser.name,
        forwardedToRole: 'DEPT_ADMIN',
      };
    }

    /**
     * Universal hardcoded shortcut (2):
     * If a Department Admin submits, always forward to the Approval Authority
     * of the same department, regardless of what the "start" node in the
     * workflow points to. This avoids any accidental hop back to Inward Desk.
     */
    if (isDeptAdmin && routingDepartmentId) {
      const targetUser = await this.prisma.user.findFirst({
        where: {
          ...departmentalRoleInDepartmentWhere(
            'APPROVAL_AUTHORITY',
            routingDepartmentId,
          ),
          isActive: true,
        },
        include: { division: true },
      });

      if (!targetUser) {
        throw new NotFoundException(
          'No Approval Authority found for this department. Please ensure an Approval Authority is assigned.',
        );
      }

      const targetDivisionId = targetUser.divisionId ?? file.currentDivisionId;

      const forwardedFile = await this.prisma.file.update({
        where: { id: fileId },
        data: {
          assignedToId: targetUser.id,
          currentDivisionId: targetDivisionId,
          status: FileStatus.IN_PROGRESS,
        },
      });

      await this.prisma.fileRouting.create({
        data: {
          fileId,
          fromUserId: userId,
          toUserId: targetUser.id,
          toDivisionId: targetDivisionId,
          action: FileAction.FORWARDED,
          actionString: 'forward',
          remarks:
            remarks ||
            `Submitted by Department Admin to Approval Authority`,
        },
      });

      await this.createAuditLog(
        fileId,
        userId,
        'forward',
        remarks || `Department Admin submitted file to Approval Authority`,
      );

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

      return {
        file: forwardedFile,
        approvedBy: user.name,
        forwardedTo: targetUser.name,
        forwardedToRole: 'APPROVAL_AUTHORITY',
      };
    }

    /**
     * Universal hardcoded shortcut (3):
     * If an Approval Authority submits, always forward to the Dispatcher
     * of the same department. This keeps the fixed chain:
     *   Inward → Section Officer → Dept Admin → Approval Authority → Dispatcher
     */
    if (isApprovalAuthority && routingDepartmentId) {
      const targetUser = await this.prisma.user.findFirst({
        where: {
          departmentId: routingDepartmentId,
          roles: { has: 'DISPATCHER' },
          isActive: true,
        },
        include: { division: true },
      });

      if (!targetUser) {
        throw new NotFoundException(
          'No Dispatcher found for this department. Please ensure a Dispatcher is assigned.',
        );
      }

      const targetDivisionId = targetUser.divisionId ?? file.currentDivisionId;

      // Dispatcher only sees APPROVED files. Keep status APPROVED so Dispatcher
      // can see the file in their inbox. Status becomes IN_PROGRESS only when
      // Dispatcher forwards to another department.
      const forwardedFile = await this.prisma.file.update({
        where: { id: fileId },
        data: {
          assignedToId: targetUser.id,
          currentDivisionId: targetDivisionId,
          status: FileStatus.APPROVED,
        },
      });

      await this.prisma.fileRouting.create({
        data: {
          fileId,
          fromUserId: userId,
          toUserId: targetUser.id,
          toDivisionId: targetDivisionId,
          action: FileAction.FORWARDED,
          actionString: 'forward',
          remarks:
            remarks || `Submitted by Approval Authority to Dispatcher`,
        },
      });

      await this.createAuditLog(
        fileId,
        userId,
        'forward',
        remarks || `Approval Authority submitted file to Dispatcher`,
      );

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

      return {
        file: forwardedFile,
        approvedBy: user.name,
        forwardedTo: targetUser.name,
        forwardedToRole: 'DISPATCHER',
      };
    }

    // Workflow-driven routing: always prefer workflow engine when a default
    // workflow is configured for the department. This ensures that any edits
    // to the workflow definition are reflected in file forwarding behaviour.
    let execution = await this.workflowEngine.getExecutionForFile(fileId);

    // If no running execution exists yet but the department has a default
    // workflow, start it now so that routing follows the configured flow.
    // Use the file's department (routingDepartmentId) so Submit always follows
    // the workflow chain of the department that currently owns this file.
    if (!execution && routingDepartmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: routingDepartmentId },
        include: {
          defaultWorkflow: {
            include: {
              nodes: true,
              edges: true,
            },
          },
        },
      });

      // Use department's default workflow, or fall back to an active global workflow
      // so departments (e.g. Finance) work without having to set default per department.
      let wf = department?.defaultWorkflow;
      if ((!wf || !wf.isActive) && routingDepartmentId) {
        const globalWorkflow = await this.prisma.workflow.findFirst({
          where: { departmentId: null, isActive: true },
          include: { nodes: true, edges: true },
          orderBy: { createdAt: 'asc' },
        });
        if (globalWorkflow) wf = globalWorkflow as any;
      }

      if (wf && wf.isActive) {
        // Decide which workflow node should be the "current" node based
        // on the actor's primary role in the approval chain.
        let primaryRoleForRouting: string | null = null;
        if (isSectionOfficer) primaryRoleForRouting = 'SECTION_OFFICER';
        else if (isDeptAdmin) primaryRoleForRouting = 'DEPT_ADMIN';
        else if (isApprovalAuthority)
          primaryRoleForRouting = 'APPROVAL_AUTHORITY';

        let startNodeForActor =
          primaryRoleForRouting &&
          wf.nodes.find(
            (n: any) =>
              n.nodeType === 'task' &&
              n.assigneeType === 'role' &&
              n.assigneeValue === primaryRoleForRouting,
          );

        // Fallbacks: first task after start, or the start node itself
        if (!startNodeForActor) {
          startNodeForActor =
            this.workflowEngine.getFirstTaskNodeAfterStart(wf) ??
            wf.nodes.find((n: any) => n.nodeType === 'start');
        }

        if (startNodeForActor) {
          // Manually create a workflow execution anchored at this node.
          const createdExecution = await this.prisma.workflowExecution.create({
            data: {
              workflowId: wf.id,
              fileId,
              currentNodeId: startNodeForActor.nodeId,
              status: 'running',
              variables: {},
            },
          });

          await this.prisma.workflowExecutionStep.create({
            data: {
              executionId: createdExecution.id,
              nodeId: startNodeForActor.nodeId,
              nodeName: startNodeForActor.label,
              result: 'started',
              startedAt: new Date(),
            },
          });

          execution = await this.workflowEngine.getExecutionForFile(fileId);
        }
      }
    }

    // If we now have a workflow execution, drive routing entirely from it.
    if (execution) {
      if (!execution.workflow?.nodes?.length) {
        await this.prisma.workflowExecution.updateMany({
          where: { fileId, status: 'running' },
          data: { status: 'completed', completedAt: new Date() },
        });
        throw new BadRequestException(
          'Workflow definition is missing or invalid. Use Forward to send the file, or set a valid default workflow in Admin → Departments.',
        );
      }
      const result = await this.workflowEngine.executeStep(
        execution.id,
        userId,
        'approve',
        { remarks },
      );
      let nextNode = result.nextNode;
      // If the immediate next node is a decision, resolve through to the actual task or end
      // so we assign the file to the correct user (Dept Admin, Approval Authority, etc.)
      if (nextNode?.nodeType === 'decision' && execution.workflow) {
        const resolved = await this.workflowEngine.resolveNextTaskOrEnd(
          execution.workflow,
          nextNode,
          'approve',
          execution.variables as Record<string, any>,
        );
        nextNode = resolved ?? nextNode;
      }

      const updatedFile = await this.prisma.file.findUnique({
        where: { id: fileId },
        include: { assignedTo: true },
      });
      if (!updatedFile) {
        return { file: await this.prisma.file.findUnique({ where: { id: fileId }, include: { assignedTo: true } }), approvedBy: user.name, forwardedTo: null, forwardedToRole: 'workflow' };
      }

      // First, approve the file
      await this.prisma.file.update({
        where: { id: fileId },
        data: { status: FileStatus.APPROVED },
      });
      await this.prisma.fileRouting.create({
        data: {
          fileId,
          fromUserId: userId,
          action: FileAction.APPROVED,
          actionString: 'approve',
          remarks: remarks || 'Approved and forwarded',
        },
      });
        await this.createAuditLog(fileId, userId, 'approve', remarks || 'File approved');

      if (nextNode?.nodeType === 'end') {
        await this.prisma.file.update({
          where: { id: fileId },
          data: { status: FileStatus.APPROVED, assignedToId: null },
        });
        await this.prisma.fileRouting.create({
          data: {
            fileId,
            fromUserId: userId,
            action: FileAction.FORWARDED,
            actionString: 'forward',
            remarks: remarks || 'Workflow completed',
          },
        });
        await this.createAuditLog(fileId, userId, 'forward', 'Workflow completed');
        const endFile = await this.prisma.file.findUnique({ where: { id: fileId }, include: { assignedTo: true } });
        return { file: endFile, approvedBy: user.name, forwardedTo: null, forwardedToRole: 'workflow_completed' };
      }

      if (nextNode && nextNode.nodeType === 'task') {
        // Resolve next assignee in submitter's department so file goes to same-dept next role (e.g. HR Admin, not Finance Dispatcher).
        const fileForAssignee = { ...updatedFile, departmentId: routingDepartmentId ?? updatedFile.departmentId };
        const { assigneeId, divisionId } =
          await this.workflowEngine.resolveAssigneeForNode(nextNode, fileForAssignee);
        if (!assigneeId) {
          throw new NotFoundException(
            'Next workflow step has no assignee. Please configure the workflow node or ensure users are assigned.',
          );
        }
        const targetUser = await this.prisma.user.findUnique({
          where: { id: assigneeId },
          include: { division: true },
        });
        if (!targetUser) {
          throw new NotFoundException('Next assignee user not found');
        }
        const targetDivisionId = divisionId ?? updatedFile.currentDivisionId;

        await this.prisma.file.update({
          where: { id: fileId },
          data: {
            assignedToId: targetUser.id,
            currentDivisionId: targetDivisionId,
            status: FileStatus.IN_PROGRESS,
            ...(routingDepartmentId && routingDepartmentId !== updatedFile.departmentId
              ? { departmentId: routingDepartmentId }
              : {}),
          },
        });
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
              .then((r) => (r._max.sortOrder ?? 0) + 1)) ?? 1;
          await this.prisma.forwardQueue.create({
            data: {
              fileId,
              toUserId: targetUser.id,
              toDivisionId: targetDivisionId ?? updatedFile.currentDivisionId ?? '',
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
            title: 'File queued',
            message: `File has been queued to your inbox (capacity reached).`,
          });
        }
        const wfFile = await this.prisma.file.findUnique({ where: { id: fileId }, include: { assignedTo: true } });
        return { file: wfFile, approvedBy: user.name, forwardedTo: targetUser.name, forwardedToRole: 'workflow' };
      }

      // nextNode is null or not task/end (e.g. decision) – leave file approved, no forward
      const noForwardFile = await this.prisma.file.findUnique({ where: { id: fileId }, include: { assignedTo: true } });
      return { file: noForwardFile, approvedBy: user.name, forwardedTo: null, forwardedToRole: 'workflow' };
    }

    // If no workflow is configured, give a clear message. If the department
    // has a default workflow set but it's inactive or invalid, say so.
    if (file.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: file.departmentId },
        select: { defaultWorkflowId: true, defaultWorkflow: { select: { id: true, name: true, isActive: true } } },
      });
      if (dept?.defaultWorkflowId) {
        if (!dept.defaultWorkflow) {
          throw new BadRequestException(
            'The default workflow for this department was removed. Please set a new default workflow in Admin → Departments → [Department] → Default workflow.',
          );
        }
        if (!dept.defaultWorkflow.isActive) {
          throw new BadRequestException(
            `The default workflow "${dept.defaultWorkflow.name}" is inactive. Activate it in Admin → Workflows, or choose another default in Admin → Departments → [Department].`,
          );
        }
        // Workflow is set and active but we didn't create an execution (e.g. no task nodes for this role).
        throw new BadRequestException(
          'The default workflow has no valid step for your role or is missing task nodes. Edit the workflow in Admin → Workflows (add task nodes and assign roles), or use standard forward actions.',
        );
      }
    }

    // No workflow configured for this department: approve the file and let the user
    // use the Forward button to choose a recipient (instead of blocking with an error).
    const deptForMessage =
      file.departmentId &&
      (await this.prisma.department.findUnique({
        where: { id: file.departmentId },
        select: { name: true, code: true },
      }));
    const deptLabel = deptForMessage ? `${deptForMessage.name} (${deptForMessage.code})` : 'this department';

    await this.prisma.file.update({
      where: { id: fileId },
      data: { status: FileStatus.APPROVED },
    });
    await this.prisma.fileRouting.create({
      data: {
        fileId,
        fromUserId: userId,
        action: FileAction.APPROVED,
        actionString: 'approve',
        remarks: remarks || 'File approved (no workflow configured)',
      },
    });
    await this.createAuditLog(fileId, userId, 'approve', remarks || 'File approved');
    const approvedFile = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { assignedTo: true },
    });
    return {
      file: approvedFile,
      approvedBy: user.name,
      forwardedTo: null,
      forwardedToRole: 'no_workflow',
      message: `File approved. No workflow is configured for ${deptLabel}. Set a default workflow in Admin → Departments → ${deptLabel} → Default workflow, or use the Forward button to send it to someone.`,
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
      select: {
        roles: true,
        departmentId: true,
        administeredDepartments: { select: { id: true } },
      },
    });
    const roles = (actor?.roles ?? []) as string[];
    const isDeveloper = roles.includes('DEVELOPER');
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    const isDeptAdmin = roles.includes('DEPT_ADMIN');
    const actorAdminScope = actor ? getDepartmentalScopeDepartmentIds(actor) : [];
    const fileInDeptAdminScope =
      actorAdminScope.length > 0 && actorAdminScope.includes(file.departmentId);

    if (action === 'hold') {
      if (!isDeveloper && !isSuperAdmin && !isDeptAdmin) {
        throw new ForbiddenException('Only Department Admin, Developer or Super Admin can hold files');
      }
      if (isDeptAdmin && !isDeveloper && !isSuperAdmin && !fileInDeptAdminScope) {
        throw new ForbiddenException('Department Admin can only hold files within their department');
      }
    }
    if (action === 'release') {
      if (!isDeveloper && !isSuperAdmin && !isDeptAdmin) {
        throw new ForbiddenException('Only Department Admin, Developer or Super Admin can release files from hold');
      }
      if (isDeptAdmin && !isDeveloper && !isSuperAdmin && !fileInDeptAdminScope) {
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
      case 'close':
        newStatus = file.status;
        fileAction = FileAction.CLOSED;
        break;
      default:
        throw new ForbiddenException('Invalid action');
    }

    const updateData: any = {
      status: newStatus,
      isOnHold: action === 'hold',
      holdReason: action === 'hold' ? remarks : null,
    };
    if (action === 'close') {
      updateData.isClosed = true;
      updateData.closedAt = new Date();
    }
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: updateData,
    });

    // When host closes the file/process, close the current process cycle (Rule 3 & 6)
    const actorIsHostForClose =
      !!actor &&
      !!file.originDepartmentId &&
      (actorAdminScope.length > 0
        ? actorAdminScope.includes(file.originDepartmentId)
        : actor.departmentId === file.originDepartmentId);
    if (action === 'close' && file.currentProcessCycleId && actorIsHostForClose) {
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
        OR: [{ roles: { has: 'SUPER_ADMIN' } }, deptAdminInDepartmentWhere(file.departmentId)],
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
          deptAdminInDepartmentWhere(request.file.departmentId),
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
    const isTechPanel = userRoles.includes('DEVELOPER');

    // Recall permission is explicit per-user setting (not role-based).
    const recallAllowedSetting = await this.prisma.systemSettings.findFirst({
      where: { key: 'RECALL_ALLOWED_USER_IDS', departmentId: null },
      select: { value: true },
    });
    const recallAllowedIds = (recallAllowedSetting?.value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!isTechPanel && !recallAllowedIds.includes(userId)) {
      throw new ForbiddenException('You are not configured as a recall authority');
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const recallDestinationSetting = await this.prisma.systemSettings.findFirst({
      where: { key: 'RECALL_DESTINATION_USER_ID', departmentId: null },
      select: { value: true },
    });
    const recallDestinationUserId = (recallDestinationSetting?.value ?? '').trim() || null;
    if (!recallDestinationUserId) {
      throw new BadRequestException('Recall destination is not configured. Ask Tech Panel to configure RECALL_DESTINATION_USER_ID');
    }
    const recallDestinationUser = await this.prisma.user.findUnique({
      where: { id: recallDestinationUserId },
      select: { id: true, divisionId: true, departmentId: true, isActive: true },
    });
    if (!recallDestinationUser || !recallDestinationUser.isActive) {
      throw new BadRequestException('Recall destination user is invalid or inactive');
    }

    const previousAssigneeId = file.assignedToId;

    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.RECALLED,
        assignedToId: recallDestinationUser.id,
        currentDivisionId: recallDestinationUser.divisionId ?? null,
        departmentId: recallDestinationUser.departmentId ?? file.departmentId,
        isInQueue: false,
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
        toUserId: recallDestinationUser.id,
        toDivisionId: recallDestinationUser.divisionId ?? undefined,
        toDepartmentId: recallDestinationUser.departmentId ?? undefined,
        remarks: remarks || 'File recalled',
      },
    });

    // Create audit log
    await this.createAuditLog(
      fileId,
      userId,
      'recall',
      remarks || 'File recalled',
    );

    await this.notificationsService.createNotification({
      userId: recallDestinationUser.id,
      type: 'file_recalled',
      title: 'File Recalled To You',
      message: `File ${file.fileNumber}: ${file.subject} has been recalled to your inbox.`,
      fileId: file.id,
      priority: 'high',
      actionRequired: true,
      actionType: 'open_file',
      metadata: { link: `/files/${file.id}` },
    });

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
    /**
     * When retrying after unique constraint, use offset so we get a different number.
     * We compute the next sequence from the current MAX(sequence) instead of COUNT,
     * so deletions or backfilled numbers cannot cause collisions.
     */
    sequenceOffset = 0,
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

    // Atomic counter per (department, year) to avoid collisions under concurrency.
    // sequenceOffset is kept for safety if we need to retry after a rare collision.
    const nextSeq = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.fileNumberCounter.upsert({
        where: { departmentId_year: { departmentId, year } },
        create: { departmentId, year, currentSeq: 0 },
        update: {},
        select: { id: true },
      });
      const updated = await tx.fileNumberCounter.update({
        where: { id: counter.id },
        data: { currentSeq: { increment: 1 + sequenceOffset } },
        select: { currentSeq: true },
      });
      return updated.currentSeq;
    });

    const seq = String(nextSeq).padStart(4, '0');

    // SAGE Rule 1: Eliminate duplicate prefix (e.g. FIN-FIN → FIN)
    if (divisionAbbr === deptCode) {
      return `${deptCode}-${year}-${seq}`;
    }
    return `${deptCode}-${divisionAbbr}-${year}-${seq}`;
  }

  /**
   * Set due time/allotted time for a file (Tech Panel only).
   * Tech Panel is represented by DEVELOPER role.
   */
  async setFileDueTime(
    fileId: string,
    userId: string,
    userRoles: string[],
    allottedTimeInHours: number,
  ) {
    // Tech Panel only (DEVELOPER). Keep this strict per policy.
    if (!userRoles.includes(UserRole.DEVELOPER)) {
      throw new ForbiddenException('Only Tech Panel can set due time for files');
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { department: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
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

  /**
   * Backfill default due time for existing files that don't have it.
   * Uses defaultSlaNormHours (department-specific then global) for each file's department.
   * Caller must be Super Admin / Developer.
   */
  async backfillDueTimesForExistingFiles(): Promise<{ updated: number }> {
    const filesWithoutDueTime = await this.prisma.file.findMany({
      where: { allottedTime: null },
      select: { id: true, departmentId: true },
    });
    if (filesWithoutDueTime.length === 0) {
      return { updated: 0 };
    }
    const now = new Date();
    let updated = 0;
    for (const file of filesWithoutDueTime) {
      const defaultSlaSetting = await this.prisma.systemSettings
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
      const defaultSlaHours = defaultSlaSetting
        ? parseInt(defaultSlaSetting.value, 10)
        : null;
      if (
        defaultSlaHours == null ||
        Number.isNaN(defaultSlaHours) ||
        defaultSlaHours <= 0
      ) {
        continue;
      }
      const allottedTimeInSeconds = defaultSlaHours * 3600;
      const deskDueDate = new Date(
        now.getTime() + allottedTimeInSeconds * 1000,
      );
      await this.prisma.file.update({
        where: { id: file.id },
        data: {
          deskArrivalTime: now,
          allottedTime: allottedTimeInSeconds,
          deskDueDate,
        },
      });
      await this.timing.updateTimeRemaining(file.id);
      updated += 1;
    }
    return { updated };
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
