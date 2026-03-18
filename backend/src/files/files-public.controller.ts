import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';
import { FilesService } from './files.service';

// Public controller for file downloads - no JWT authentication required
// Files are still protected by requiring knowledge of the attachment ID
@Controller('files')
export class FilesPublicController {
  constructor(private filesService: FilesService) {}

  // Proxy endpoint to serve files through backend (avoids MinIO signature issues).
  // Sends buffer so preview gets correct PDF bytes (no stream conversion issues).
  @Get('attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, mimeType } =
      await this.filesService.getAttachmentBuffer(attachmentId);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'public, max-age=3600',
      'Content-Length': String(buffer.length),
    });

    return new StreamableFile(buffer);
  }

  // Legacy endpoint for files stored with s3Key directly on File model
  @Get('attachments/legacy/download')
  async downloadLegacyFile(
    @Query('key') s3Key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const stream = await this.filesService.getLegacyFileStream(s3Key);

    // Extract filename from s3Key (format: timestamp-filename)
    const filename = s3Key.includes('-')
      ? s3Key.substring(s3Key.indexOf('-') + 1)
      : s3Key;

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'public, max-age=3600',
    });

    return new StreamableFile(Readable.from(stream as any));
  }
}
