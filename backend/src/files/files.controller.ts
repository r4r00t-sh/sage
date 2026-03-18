import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  Res,
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { hasGodRole } from '../auth/auth.helpers';
import { FileUploadGuard } from '../security/file-upload.guard';

// 50MB per file for uploads (docker-compose has no nginx, so backend must allow large bodies)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post()
  @UseGuards(FileUploadGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  async createFile(
    @Request() req,
    @Body()
    body: {
      subject?: string;
      description?: string;
      departmentId?: string;
      divisionId?: string;
      priority?: string;
      dueDate?: string;
    },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const departmentId = body?.departmentId;
    if (!subject) {
      throw new BadRequestException('Subject is required');
    }
    if (!departmentId || typeof departmentId !== 'string') {
      throw new BadRequestException('Department is required');
    }
    try {
      return await this.filesService.createFile({
        subject,
        description: body.description,
        departmentId,
        createdById: req.user.id,
        divisionId: body.divisionId,
        priority: body.priority as any,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        files: files?.map((file) => ({
          buffer: file.buffer,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        })),
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException(
        e instanceof Error ? e.message : 'Failed to create file',
      );
    }
  }

  @Get('recent')
  async getRecentFiles(@Request() req) {
    return this.filesService.getRecentFiles(req.user.id, 10);
  }

  @Get('queue')
  async getQueue(@Request() req) {
    return this.filesService.getQueueForUser(req.user.id);
  }

  @Get('sent')
  async getSentFiles(
    @Request() req,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.filesService.getSentFiles(
      req.user.id,
      req.user.roles ?? [],
      req.user.departmentId,
      {
        status,
        priority,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      },
    );
  }

  @Post('queue/:fileId/claim')
  async claimFromQueue(
    @Param('fileId') fileId: string,
    @Request() req,
  ) {
    return this.filesService.claimFromQueue(fileId, req.user.id);
  }

  @Get()
  async getAllFiles(
    @Request() req,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('originated') originated?: string,
    @Query('redlisted') redlisted?: string,
    @Query('assignedToMe') assignedToMe?: string,
  ) {
    return this.filesService.getAllFiles(
      req.user.id,
      req.user.roles ?? [],
      req.user.departmentId,
      {
        status,
        search,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50,
        originated: originated === 'true',
        redlisted: redlisted === 'true',
        assignedToMe: assignedToMe === 'true',
      },
    );
  }

  /** Apply default due time to all existing files that don't have it. Super Admin / Developer only. */
  @Post('backfill-due-times')
  async backfillDueTimes(@Request() req) {
    if (!hasGodRole(req.user)) {
      throw new ForbiddenException('Super Admin or Developer only');
    }
    return this.filesService.backfillDueTimesForExistingFiles();
  }

  // Export full packed PDF – must be before :id so /files/:id/export/pdf is matched
  @Get(':id/export/pdf')
  async exportFilePdf(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } =
      await this.filesService.exportFilePdf(id, req.user.id);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        filename,
      )}"`,
      'Content-Length': String(buffer.length),
    });

    res.send(buffer);
  }

  @Get(':id')
  async getFile(@Param('id') id: string, @Request() req) {
    return this.filesService.getFileById(id, req.user.id);
  }

  // Attachment endpoints
  @Post(':id/attachments')
  @UseGuards(FileUploadGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  async addAttachments(
    @Param('id') id: string,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const results = await Promise.all(
      files.map((file) =>
        this.filesService.addAttachment(id, req.user.id, {
          buffer: file.buffer,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }),
      ),
    );
    return { attachments: results };
  }

  @Get('attachments/:attachmentId/url')
  async getAttachmentUrl(@Param('attachmentId') attachmentId: string) {
    const url = await this.filesService.getAttachmentUrl(attachmentId);
    return { url };
  }

  // Note: Download endpoints moved to FilesPublicController (no auth required for img/iframe)

  @Delete('attachments/:attachmentId')
  async deleteAttachment(
    @Param('attachmentId') attachmentId: string,
    @Request() req,
  ) {
    return this.filesService.deleteAttachment(attachmentId, req.user.id);
  }

  @Post(':id/forward')
  async forwardFile(
    @Param('id') id: string,
    @Request() req,
    @Body() body: {
      toDivisionId?: string;
      toDepartmentId?: string;
      toUserId?: string | null;
      remarks?: string;
      /** Inward Desk Submit: auto-forward to Section Officer in same department (workflow next). */
      submitToSectionOfficer?: boolean;
      /** Multi-forward: one note per recipient. Each item can have toDepartmentId, toDivisionId, toUserId, remarks. */
      recipients?: Array<{
        toDepartmentId?: string;
        toDivisionId?: string;
        toUserId?: string | null;
        remarks?: string;
      }>;
    },
  ) {
    return this.filesService.forwardFile(
      id,
      req.user.id,
      body.toDivisionId,
      body.toDepartmentId,
      body.toUserId ?? null,
      body.remarks,
      body.recipients,
      body.submitToSectionOfficer,
    );
  }

  @Post(':id/approve-and-forward')
  async approveAndForward(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { remarks?: string },
  ) {
    try {
      return await this.filesService.approveAndForward(
        id,
        req.user.id,
        body.remarks,
      );
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err?.response?.message ?? err?.message ?? 'Submit failed. Please try again or use Forward to send the file.',
      );
    }
  }

  @Post(':id/action')
  async performAction(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { action: string; remarks?: string },
  ) {
    return this.filesService.performAction(
      id,
      req.user.id,
      body.action,
      body.remarks,
    );
  }

  @Post(':id/request-extra-time')
  async requestExtraTime(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { additionalDays: number; reason?: string },
  ) {
    return this.filesService.requestExtraTime(
      id,
      req.user.id,
      body.additionalDays,
      body.reason,
    );
  }

  @Get(':id/extension-requests')
  async getExtensionRequests(@Param('id') id: string) {
    return this.filesService.getExtensionRequests(id);
  }

  @Get('extension-requests/pending')
  async getPendingExtensionRequests(@Request() req) {
    return this.filesService.getPendingExtensionRequests(req.user.id);
  }

  @Post('extension-requests/:requestId/approve')
  async approveExtension(
    @Param('requestId') requestId: string,
    @Request() req,
    @Body() body: { remarks?: string },
  ) {
    return this.filesService.approveExtension(
      requestId,
      req.user.id,
      true,
      body.remarks,
    );
  }

  @Post('extension-requests/:requestId/deny')
  async denyExtension(
    @Param('requestId') requestId: string,
    @Request() req,
    @Body() body: { remarks?: string },
  ) {
    return this.filesService.approveExtension(
      requestId,
      req.user.id,
      false,
      body.remarks,
    );
  }

  @Post(':id/recall')
  async recallFile(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { remarks?: string },
  ) {
    return this.filesService.recallFile(
      id,
      req.user.id,
      req.user.roles ?? [],
      req.user.departmentId ?? null,
      body.remarks,
    );
  }

  @Post(':id/set-due-time')
  async setFileDueTime(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { allottedTimeInHours: number },
  ) {
    return this.filesService.setFileDueTime(
      id,
      req.user.id,
      req.user.roles ?? [],
      body.allottedTimeInHours,
    );
  }
}
