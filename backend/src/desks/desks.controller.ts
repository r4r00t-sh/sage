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
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
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
    const deptId =
      departmentId ||
      ((req.user.roles ?? []).includes(UserRole.DEPT_ADMIN)
        ? req.user.departmentId
        : undefined);
    return this.desksService.getDesks(deptId, divisionId);
  }

  // Get desk by ID
  @Get(':id')
  async getDeskById(@Param('id') id: string) {
    return this.desksService.getDeskById(id);
  }

  // Get desk workload summary
  @Get('workload/summary')
  async getDeskWorkloadSummary(@Request() req) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.desksService.getDeskWorkloadSummary(departmentId);
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
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
    },
  ) {
    return this.desksService.updateDesk(id, req.user.id, req.user.roles ?? [], body);
  }

  // Delete desk
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
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
}
