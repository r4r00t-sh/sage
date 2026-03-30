import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { AnalyticsVisualizationService } from './analytics-visualization.service';
import { getDeptAdminDepartmentIds } from '../auth/auth.helpers';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    private visualizationService: AnalyticsVisualizationService,
  ) {}

  /** Own performance metrics – any authenticated user */
  @Get('my-performance')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DEPT_ADMIN,
    UserRole.CHAT_MANAGER,
    UserRole.APPROVAL_AUTHORITY,
    UserRole.SECTION_OFFICER,
    UserRole.INWARD_DESK,
    UserRole.DISPATCHER,
    UserRole.USER,
  )
  async getMyPerformance(@Request() req) {
    return this.analyticsService.getMyPerformance(req.user.id);
  }

  /** Own activity heatmap – any authenticated user */
  @Get('my-activity-heatmap')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DEPT_ADMIN,
    UserRole.CHAT_MANAGER,
    UserRole.APPROVAL_AUTHORITY,
    UserRole.SECTION_OFFICER,
    UserRole.INWARD_DESK,
    UserRole.DISPATCHER,
    UserRole.USER,
  )
  async getMyActivityHeatmap(
    @Request() req,
    @Query('year') year?: string,
  ) {
    return this.analyticsService.getActivityHeatmap({
      scope: 'user',
      userId: req.user.id,
      year: year ? parseInt(year, 10) : undefined,
    });
  }

  @Get('dashboard')
  @Roles(
    UserRole.DEVELOPER,
    UserRole.SUPER_ADMIN,
    UserRole.DEPT_ADMIN,
    UserRole.CHAT_MANAGER,
    UserRole.APPROVAL_AUTHORITY,
    UserRole.SECTION_OFFICER,
    UserRole.INWARD_DESK,
    UserRole.DISPATCHER,
    UserRole.USER,
    UserRole.SUPPORT,
  )
  async getDashboardAnalytics(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    // Global overview for all users (read-only transparency view).
    const departmentId = undefined;
    return this.analyticsService.getDashboardAnalytics(
      departmentId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get('departments')
  @Roles(UserRole.SUPER_ADMIN)
  async getDepartmentAnalytics() {
    return this.analyticsService.getDepartmentAnalytics();
  }

  @Get('users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getUserPerformanceAnalytics(
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.analyticsService.getUserPerformanceAnalytics(
      departmentId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('processing-time')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getProcessingTimeAnalytics(@Request() req) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.analyticsService.getProcessingTimeAnalytics(departmentId);
  }

  @Get('bottlenecks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getBottleneckAnalysis(@Request() req) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.analyticsService.getBottleneckAnalysis(departmentId);
  }

  @Get('activity-heatmap')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getActivityHeatmap(
    @Request() req,
    @Query('scope') scope?: 'user' | 'department',
    @Query('userId') userId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('year') year?: string,
  ) {
    const roles = (req.user.roles ?? []) as string[];
    const isDeptAdmin = roles.includes(UserRole.DEPT_ADMIN);
    const isSuperAdmin = roles.includes(UserRole.SUPER_ADMIN);
    const scopeVal = scope === 'department' ? 'department' : 'user';
    const deptId =
      scopeVal === 'department'
        ? isSuperAdmin
          ? departmentId ?? req.user.departmentId
          : req.user.departmentId
        : undefined;
    return this.analyticsService.getActivityHeatmap({
      scope: scopeVal,
      userId: scopeVal === 'user' ? req.user.id : undefined,
      departmentId: deptId,
      year: year ? parseInt(year, 10) : undefined,
    });
  }

  @Get('report')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async generateReport(
    @Request() req,
    @Query('type')
    type: 'summary' | 'detailed' | 'user_performance' | 'department',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.analyticsService.generateReport(
      type || 'summary',
      departmentId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get('report/export')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  @Header('Content-Type', 'text/csv')
  async exportReportCSV(
    @Request() req,
    @Res() res: Response,
    @Query('type')
    type: 'summary' | 'detailed' | 'user_performance' | 'department',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    const data: any = await this.analyticsService.generateReport(
      type || 'detailed',
      departmentId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );

    let csv = '';
    const filename = `efiling-report-${type}-${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'detailed' && data.files) {
      csv = this.convertToCSV(data.files);
    } else if (type === 'user_performance' && data.users) {
      csv = this.convertToCSV(data.users);
    } else if (type === 'department' && data.departments) {
      csv = this.convertToCSV(data.departments);
    } else if (data.summary) {
      csv = this.convertSummaryToCSV(data);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          if (typeof value === 'string' && value.includes(','))
            return `"${value}"`;
          return String(value);
        })
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private convertSummaryToCSV(data: any): string {
    const lines: string[] = [];
    lines.push('Metric,Value');

    if (data.summary) {
      Object.entries(data.summary).forEach(([key, value]) => {
        lines.push(`${key},${value}`);
      });
    }

    if (data.filesByPriority) {
      lines.push('');
      lines.push('Files by Priority');
      lines.push('Priority,Count');
      data.filesByPriority.forEach((p: any) => {
        lines.push(`${p.priority},${p.count}`);
      });
    }

    return lines.join('\n');
  }

  // ============================================
  // VISUALIZATION ENDPOINTS
  // ============================================

  // Executive Dashboard
  @Get('executive-dashboard')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getExecutiveDashboard(@Request() req) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.visualizationService.getExecutiveDashboard(departmentId);
  }

  // Bottleneck Heatmap
  @Get('heatmap')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getBottleneckHeatmap(
    @Request() req,
    @Query('timeRange') timeRange?: 'daily' | 'weekly',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.visualizationService.getBottleneckHeatmap(
      departmentId,
      timeRange || 'daily',
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  // Aging Bucket Report
  @Get('aging-buckets')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getAgingBucketReport(@Request() req) {
    const departmentId =
      (req.user.roles ?? []).includes(UserRole.DEPT_ADMIN) ? req.user.departmentId : undefined;
    return this.visualizationService.getAgingBucketReport(departmentId);
  }

  // Red-List Morgue
  @Get('redlist-morgue')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  async getRedListMorgue(@Request() req) {
    if ((req.user.roles ?? []).includes(UserRole.DEPT_ADMIN)) {
      const scope = getDeptAdminDepartmentIds(req.user);
      if (scope.length === 0) {
        return this.visualizationService.getRedListMorgueVisualization(undefined, []);
      }
      return this.visualizationService.getRedListMorgueVisualization(
        scope.length === 1 ? scope[0] : undefined,
        scope.length > 1 ? scope : undefined,
      );
    }
    return this.visualizationService.getRedListMorgueVisualization();
  }
}
