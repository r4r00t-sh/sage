import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { getDeptAdminDepartmentIds } from '../auth/auth.helpers';
import { DesksService } from './desks.service';
import { DeskPerformanceService } from './desk-performance.service';

@Controller('desks')
@UseGuards(JwtAuthGuard)
export class DesksController {
  constructor(
    private desksService: DesksService,
    private deskPerformanceService: DeskPerformanceService,
  ) {}

  // Create desk (Admin only)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.DEVELOPER)
  async createDesk(
    @Request() req,
    @Body()
    body: {
      name: string;
      code: string;
      description?: string;
      departmentId: string;
      divisionId?: string;
      maxFilesPerDay?: number;
      iconType?: string;
      slaNorm?: number; // SLA norm in hours
    },
  ) {
    return this.desksService.createDesk(req.user.id, req.user.roles ?? [], body);
  }

  // Get all desks
  @Get()
  async getDesks(
    @Request() req,
    @Query('departmentId') departmentId?: string,
    @Query('divisionId') divisionId?: string,
  ) {
    if (departmentId) {
      return this.desksService.getDesks(departmentId, divisionId);
    }
    if ((req.user.roles ?? []).includes(UserRole.DEPT_ADMIN)) {
      const scope = getDeptAdminDepartmentIds(req.user);
      if (scope.length > 1) {
        return this.desksService.getDesks(undefined, divisionId, scope);
      }
      if (scope.length === 1) {
        return this.desksService.getDesks(scope[0], divisionId);
      }
    }
    return this.desksService.getDesks(undefined, divisionId);
  }

  // Get desk by ID
  @Get(':id')
  async getDeskById(@Param('id') id: string) {
    return this.desksService.getDeskById(id);
  }

  // Get desk workload summary
  @Get('workload/summary')
  async getDeskWorkloadSummary(@Request() req) {
    if ((req.user.roles ?? []).includes(UserRole.DEPT_ADMIN)) {
      const scope = getDeptAdminDepartmentIds(req.user);
      if (scope.length > 1) {
        return this.desksService.getDeskWorkloadSummary(undefined, scope);
      }
      if (scope.length === 1) {
        return this.desksService.getDeskWorkloadSummary(scope[0]);
      }
    }
    return this.desksService.getDeskWorkloadSummary(undefined);
  }

  // Assign file to desk
  @Post('assign')
  async assignFileToDesk(
    @Request() req,
    @Body() body: { fileId: string; deskId: string },
  ) {
    return this.desksService.assignFileToDesk(
      body.fileId,
      body.deskId,
      req.user.id,
      req.user.roles ?? [],
    );
  }

  // Update desk capacity
  @Post(':id/update-capacity')
  async updateDeskCapacity(@Param('id') id: string) {
    return this.desksService.updateDeskCapacity(id);
  }

  // Check and auto-create desk if needed
  @Post('auto-create')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DEVELOPER)
  async checkAndAutoCreateDesk(
    @Request() req,
    @Body() body: { divisionId?: string },
  ) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    if (!departmentId) {
      throw new Error('Department ID required');
    }
    return this.desksService.checkAndAutoCreateDesk(
      departmentId,
      body.divisionId,
    );
  }

  // Update desk
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DEVELOPER)
  async updateDesk(
    @Param('id') id: string,
    @Request() req,
    @Body()
    body: {
      name?: string;
      description?: string;
      maxFilesPerDay?: number;
      iconType?: string;
      isActive?: boolean;
      slaNorm?: number; // SLA norm in hours
    },
  ) {
    return this.desksService.updateDesk(id, req.user.id, req.user.roles ?? [], body);
  }

  // Delete desk
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DEVELOPER)
  async deleteDesk(@Param('id') id: string, @Request() req) {
    return this.desksService.deleteDesk(id, req.user.id, req.user.roles ?? []);
  }

  // ============================================
  // DESK PERFORMANCE ANALYTICS ENDPOINTS
  // ============================================

  // Get comprehensive desk performance metrics
  @Get(':id/performance')
  async getDeskPerformance(
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return this.deskPerformanceService.getDeskPerformanceMetrics(id, from, to);
  }

  // Get desk performance score
  @Get(':id/score')
  async getDeskScore(
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return this.deskPerformanceService.calculateDeskScore(id, from, to);
  }

  // Get Flow Balance Ratio
  @Get(':id/fbr')
  async getFlowBalanceRatio(
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return {
      deskId: id,
      flowBalanceRatio: await this.deskPerformanceService.calculateFlowBalanceRatio(id, from, to),
    };
  }

  // Check desk red-list triggers
  @Get(':id/redlist-check')
  async checkDeskRedList(@Param('id') id: string) {
    return this.deskPerformanceService.checkDeskRedListTriggers(id);
  }

  // Rating analytics (0–10): Speed, Efficiency, Workload, Overload, Underload
  @Get(':id/rating-analytics')
  async getDeskRatingAnalytics(
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return this.deskPerformanceService.getDeskRatingAnalytics(id, from, to);
  }
}
