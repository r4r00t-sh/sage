import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OpinionsService } from './opinions.service';
import { FileUploadGuard } from '../security/file-upload.guard';

@Controller('opinions')
@UseGuards(JwtAuthGuard)
export class OpinionsController {
  constructor(private opinionsService: OpinionsService) {}

  // Request opinion from another department
  @Post('request')
  async requestOpinion(
    @Request() req,
    @Body()
    body: {
      fileId: string;
      requestedToDepartmentId: string;
      requestedToDivisionId?: string;
      requestedToUserId?: string;
      requestReason?: string;
      specialPermissionGranted?: boolean;
    },
  ) {
    return this.opinionsService.requestOpinion(body.fileId, req.user.id, {
      requestedToDepartmentId: body.requestedToDepartmentId,
      requestedToDivisionId: body.requestedToDivisionId,
      requestedToUserId: body.requestedToUserId,
      requestReason: body.requestReason,
      specialPermissionGranted: body.specialPermissionGranted,
    });
  }

  // Get pending opinions for current user/department (RECEIVED)
  @Get('pending')
  async getPendingOpinions(@Request() req) {
    return this.opinionsService.getPendingOpinions(
      req.user.id,
      req.user.departmentId,
    );
  }

  // Get sent opinions (opinions requested by current user/department)
  @Get('sent')
  async getSentOpinions(@Request() req) {
    return this.opinionsService.getSentOpinions(
      req.user.id,
      req.user.departmentId,
    );
  }

  // Forward opinion to another department
  @Post('requests/:id/forward')
  async forwardOpinion(
    @Param('id') opinionRequestId: string,
    @Request() req,
    @Body()
    body: {
      requestedToDepartmentId: string;
      requestedToDivisionId?: string;
      requestReason?: string;
    },
  ) {
    return this.opinionsService.forwardOpinion(opinionRequestId, req.user.id, {
      requestedToDepartmentId: body.requestedToDepartmentId,
      requestedToDivisionId: body.requestedToDivisionId,
      requestReason: body.requestReason,
    });
  }

  // Get file for opinion (view-only mode)
  @Get('requests/:id/file')
  async getFileForOpinion(
    @Param('id') opinionRequestId: string,
    @Request() req,
  ) {
    return this.opinionsService.getFileForOpinion(
      opinionRequestId,
      req.user.id,
    );
  }

  // Add opinion note
  @Post('requests/:id/notes')
  async addOpinionNote(
    @Param('id') opinionRequestId: string,
    @Request() req,
    @Body() body: { content: string },
  ) {
    return this.opinionsService.addOpinionNote(
      opinionRequestId,
      req.user.id,
      body.content,
    );
  }

  // Provide opinion (submit response)
  @Post('requests/:id/provide')
  @UseGuards(FileUploadGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async provideOpinion(
    @Param('id') opinionRequestId: string,
    @Request() req,
    @Body() body: { opinionNote: string },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.opinionsService.provideOpinion(opinionRequestId, req.user.id, {
      opinionNote: body.opinionNote,
      attachmentFiles: files?.map((file) => ({
        buffer: file.buffer,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
    });
  }

  // Return opinion
  @Post('requests/:id/return')
  async returnOpinion(@Param('id') opinionRequestId: string, @Request() req) {
    return this.opinionsService.returnOpinion(opinionRequestId, req.user.id);
  }
}
