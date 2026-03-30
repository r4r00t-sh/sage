import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getDeptAdminDepartmentIds } from '../auth/auth.helpers';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { FileUploadGuard } from '../security/file-upload.guard';
import { DispatchService } from './dispatch.service';

@Controller('dispatch')
@UseGuards(JwtAuthGuard)
export class DispatchController {
  constructor(private dispatchService: DispatchService) {}

  // Prepare file for dispatch (Admin)
  @Post('prepare')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN, UserRole.DISPATCHER)
  async prepareForDispatch(
    @Request() req,
    @Body() body: { fileId: string; remarks?: string },
  ) {
    return this.dispatchService.prepareForDispatch(
      body.fileId,
      req.user.id,
      req.user.roles ?? [],
      body.remarks,
    );
  }

  // Dispatch file (Dispatcher)
  @Post('dispatch')
  @UseGuards(RolesGuard, FileUploadGuard)
  @Roles(UserRole.DISPATCHER, UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('proofDocument'))
  async dispatchFile(
    @Request() req,
    @Body()
    body: {
      fileId: string;
      dispatchMethod: string;
      trackingNumber?: string;
      recipientName?: string;
      recipientAddress?: string;
      recipientEmail?: string;
      remarks?: string;
    },
    @UploadedFile() proofDocument?: Express.Multer.File,
  ) {
    // Note: For multiple files (proof + acknowledgement), you'd need FilesInterceptor
    // This is a simplified version - you can enhance it
    return this.dispatchService.dispatchFile(body.fileId, req.user.id, {
      ...body,
      proofDocument: proofDocument
        ? {
            buffer: proofDocument.buffer,
            filename: proofDocument.originalname,
            mimetype: proofDocument.mimetype,
            size: proofDocument.size,
          }
        : undefined,
    });
  }

  // Get dispatch proof for a file
  @Get('proof/:fileId')
  async getDispatchProof(@Param('fileId') fileId: string) {
    return this.dispatchService.getDispatchProof(fileId);
  }

  // Get all dispatch proofs
  @Get('proofs')
  async getDispatchProofs(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if ((req.user.roles ?? []).includes(UserRole.DEPT_ADMIN)) {
      const scope = getDeptAdminDepartmentIds(req.user);
      return this.dispatchService.getDispatchProofs(
        scope.length === 1 ? scope[0] : undefined,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined,
        scope.length > 1 ? scope : undefined,
      );
    }
    return this.dispatchService.getDispatchProofs(
      undefined,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  // Download dispatch proof document
  @Get('proofs/:id/download/:type')
  async downloadDispatchDocument(
    @Param('id') dispatchProofId: string,
    @Param('type') documentType: 'proof' | 'acknowledgement',
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, filename } =
      await this.dispatchService.getDispatchProofDocument(
        dispatchProofId,
        documentType,
      );

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });

    return new StreamableFile(stream as unknown as Readable);
  }
}
