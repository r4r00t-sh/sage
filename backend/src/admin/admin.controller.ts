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
import { hasAnyRole, hasRole, hasGodRole } from '../auth/auth.helpers';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  private checkAdminAccess(user: { roles?: string[] }) {
    if (!hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN'])) {
      throw new ForbiddenException('Admin access required');
    }
  }

  // Get desk status (user presence)
  @Get('desk-status')
  async getDeskStatus(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getDeskStatus(
      req.user.departmentId,
      req.user.roles ?? [],
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
    );
  }

  // Get analytics
  @Get('analytics')
  async getAnalytics(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getAnalytics(req.user.departmentId, req.user.roles ?? []);
  }

  // Get department-wise analytics (Super Admin only)
  @Get('analytics/departments')
  async getDepartmentWiseAnalytics(@Request() req) {
    if (!hasGodRole(req.user)) {
      throw new ForbiddenException('Super Admin access required');
    }
    return this.adminService.getDepartmentWiseAnalytics();
  }

  // Get red listed files
  @Get('redlist')
  async getRedListedFiles(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getRedListedFiles(
      req.user.departmentId,
      req.user.roles ?? [],
    );
  }

  // Get extension requests
  @Get('extension-requests')
  async getExtensionRequests(@Request() req) {
    this.checkAdminAccess(req.user);
    return this.adminService.getExtensionRequests(
      req.user.departmentId,
      req.user.roles ?? [],
    );
  }

  // Get system settings
  @Get('settings')
  async getSettings(@Request() req) {
    this.checkAdminAccess(req.user);
    const departmentId =
      hasRole(req.user, 'DEPT_ADMIN') ? req.user.departmentId : undefined;
    return this.adminService.getSettings(departmentId);
  }

  // Update system setting
  @Put('settings/:key')
  async updateSetting(
    @Request() req,
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    this.checkAdminAccess(req.user);
    const departmentId =
      hasRole(req.user, 'DEPT_ADMIN') ? req.user.departmentId : undefined;
    return this.adminService.updateSetting(
      key,
      body.value,
      req.user.id,
      departmentId,
    );
  }
}
