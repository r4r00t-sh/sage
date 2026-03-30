import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  hasAnyRole,
  hasRole,
  hasGodRole,
  getDeptAdminDepartmentIds,
} from '../auth/auth.helpers';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  private checkAdminAccess(user: { roles?: string[] }) {
    if (!hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN', 'APPROVAL_AUTHORITY'])) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private deptAdminScopeIds(req: { user?: { roles?: string[]; administeredDepartments?: { id: string }[]; departmentId?: string | null } }) {
    return hasRole(req.user, 'DEPT_ADMIN') ? getDeptAdminDepartmentIds(req.user) : undefined;
  }

  // Get desk status (user presence)
  @Get('desk-status')
  async getDeskStatus(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getDeskStatus(
      req.user.departmentId,
      req.user.roles ?? [],
      this.deptAdminScopeIds(req),
    );
  }

  // Get department files
  @Get('files')
  async getDepartmentFiles(
    @Request() req,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('isRedListed') isRedListed?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkAdminAccess(req.user);
    return this.adminService.getDepartmentFiles(
      req.user.departmentId,
      req.user.roles ?? [],
      {
        status,
        search,
        isRedListed:
          isRedListed === 'true'
            ? true
            : isRedListed === 'false'
              ? false
              : undefined,
        assignedToId,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50,
      },
      this.deptAdminScopeIds(req),
    );
  }

  // Get analytics
  @Get('analytics')
  async getAnalytics(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getAnalytics(
      req.user.departmentId,
      req.user.roles ?? [],
      this.deptAdminScopeIds(req),
    );
  }

  // Get department-wise analytics (Super Admin only)
  @Get('analytics/departments')
  async getDepartmentWiseAnalytics(@Request() req) {
    if (!hasGodRole(req.user)) {
      throw new ForbiddenException('Super Admin access required');
    }
    return this.adminService.getDepartmentWiseAnalytics();
  }

  /** Organisations list (for creating departments — Super Admin / Tech Panel). */
  @Get('organisations')
  async listOrganisations(@Request() req) {
    if (!hasGodRole(req.user)) {
      throw new ForbiddenException('Super Admin or Tech Panel access required');
    }
    return this.adminService.listOrganisations();
  }

  // Get red listed files
  @Get('redlist')
  async getRedListedFiles(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getRedListedFiles(
      req.user.departmentId,
      req.user.roles ?? [],
      this.deptAdminScopeIds(req),
    );
  }

  // Get extension requests
  @Get('extension-requests')
  async getExtensionRequests(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getExtensionRequests(
      req.user.departmentId,
      req.user.roles ?? [],
      this.deptAdminScopeIds(req),
    );
  }

  // Get system settings
  @Get('settings')
  async getSettings(@Request() req) {
    this.checkAdminAccess(req.user);
    const departmentId =
      hasRole(req.user, 'DEPT_ADMIN') && !hasRole(req.user, 'SUPER_ADMIN') && !hasRole(req.user, 'DEVELOPER')
        ? req.user.departmentId
        : undefined;
    const departmentIds = this.deptAdminScopeIds(req);
    return this.adminService.getSettings(
      departmentId ?? undefined,
      departmentIds?.length ? departmentIds : undefined,
    );
  }

  // Get recent system setting activity (for Features page)
  @Get('settings/activity')
  async getSettingsActivity(@Request() req) {
    if (!hasRole(req.user, 'SUPER_ADMIN') && !hasRole(req.user, 'DEVELOPER') && !hasRole(req.user, 'DEPT_ADMIN')) {
      throw new ForbiddenException('Admin access required');
    }
    const departmentId =
      hasRole(req.user, 'DEPT_ADMIN') && !hasRole(req.user, 'SUPER_ADMIN') && !hasRole(req.user, 'DEVELOPER')
        ? req.user.departmentId
        : undefined;
    const departmentIds = this.deptAdminScopeIds(req);
    return this.adminService.getSettingsActivity(
      departmentId,
      30,
      departmentIds?.length ? departmentIds : undefined,
    );
  }

  // Update system setting (Super Admin may pass body.departmentId for global null or specific dept; Dept Admin uses own department)
  @Put('settings/:key')
  async updateSetting(
    @Request() req,
    @Param('key') key: string,
    @Body() body: { value: string; departmentId?: string | null },
  ) {
    if (!hasRole(req.user, 'DEVELOPER')) {
      throw new ForbiddenException('Only Tech Panel can update global settings');
    }
    const departmentId =
      body.departmentId !== undefined
        ? body.departmentId ?? null
        : undefined;
    return this.adminService.updateSetting(
      key,
      body.value,
      req.user.id,
      departmentId,
    );
  }
}
