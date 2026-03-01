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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
      subject: string;
      description?: string;
      departmentId: string;
      divisionId?: string;
      priority?: string;
      dueDate?: string;
    },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.filesService.createFile({
      ...body,
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
  }

  @Get('recent')
  async getRecentFiles(@Request() req) {
    return this.filesService.getRecentFiles(req.user.id, 10);
  }

  @Get('queue')
  async getQueue(@Request() req) {
    return this.filesService.getQueueForUser(req.user.id);
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
      },
    );
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
    },
  ) {
    return this.filesService.forwardFile(
      id,
      req.user.id,
      body.toDivisionId,
      body.toDepartmentId,
      body.toUserId ?? null,
      body.remarks,
    );
  }

  @Post(':id/approve-and-forward')
  async approveAndForward(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { remarks?: string },
  ) {
    return this.filesService.approveAndForward(
      id,
      req.user.id,
      body.remarks,
    );
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
