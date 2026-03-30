import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { FileRedListService, RedListReason } from './file-redlist.service';
import { getDeptAdminDepartmentIds } from '../auth/auth.helpers';

@Controller('redlist')
@UseGuards(JwtAuthGuard)
export class FileRedListController {
  constructor(private fileRedListService: FileRedListService) {}

  // Get Red-List Morgue (Escalation Pit)
  @Get('morgue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getRedListMorgue(@Request() req) {
    if ((req.user.roles ?? []).includes(UserRole.DEPT_ADMIN)) {
      const scope = getDeptAdminDepartmentIds(req.user);
      if (scope.length === 0) return [];
      return this.fileRedListService.getRedListMorgue(
        scope.length === 1 ? scope[0] : undefined,
        scope.length > 1 ? scope : undefined,
      );
    }
    return this.fileRedListService.getRedListMorgue();
  }

  // Get criticality score for a file
  @Get('file/:fileId/criticality')
  async getFileCriticalityScore(@Param('fileId') fileId: string) {
    const score = await this.fileRedListService.calculateCriticalityScore(fileId);
    return { fileId, criticalityScore: score };
  }

  // Check auto-red-list trigger for a file
  @Get('file/:fileId/check-trigger')
  async checkAutoRedListTrigger(@Param('fileId') fileId: string) {
    return this.fileRedListService.checkAutoRedListTrigger(fileId);
  }

  // Manually red-list a file
  @Post('file/:fileId/manual-redlist')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN, UserRole.SECTION_OFFICER)
  async manualRedListFile(
    @Param('fileId') fileId: string,
    @Request() req,
    @Body()
    body: {
      reason: RedListReason;
      blockerOwner: string;
      remarks?: string;
    },
  ) {
    await this.fileRedListService.manualRedListFile(
      fileId,
      body.reason,
      body.blockerOwner,
      req.user.id,
      body.remarks,
    );
    return { success: true, message: 'File has been manually red-listed' };
  }

  // Rescue a file (move to specialist desk)
  @Post('file/:fileId/rescue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async rescueFile(
    @Param('fileId') fileId: string,
    @Request() req,
    @Body()
    body: {
      targetDeskId: string;
      remarks?: string;
    },
  ) {
    await this.fileRedListService.rescueFile(
      fileId,
      body.targetDeskId,
      req.user.id,
      body.remarks,
    );
    return { success: true, message: 'File has been rescued and moved to specialist desk' };
  }

  // Check and update escalations (admin only, usually cron)
  @Post('check-escalations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async checkAndUpdateEscalations() {
    await this.fileRedListService.checkAndUpdateEscalations();
    return { success: true, message: 'Escalation levels checked and updated' };
  }
}

