import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Header,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { hasAnyRole, hasGodRole } from '../auth/auth.helpers';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  /** Super Admin and Developer (tech panel) only. */
  private assertOrgStructureManager(req: { user?: { roles?: string[] } }) {
    if (!hasGodRole(req.user)) {
      throw new ForbiddenException(
        'Only Super Admin or Tech Panel can create or modify departments and divisions',
      );
    }
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async getAllDepartments() {
    return this.departmentsService.getAllDepartments();
  }

  @Get('inward-desk')
  async getInwardDeskDepartments(@Request() req) {
    return this.departmentsService.getInwardDeskDepartments(req.user.id);
  }

  @Get(':id')
  async getDepartment(@Param('id') id: string) {
    return this.departmentsService.getDepartmentById(id);
  }

  @Post()
  async createDepartment(
    @Request() req: { user?: { roles?: string[] } },
    @Body() body: { name: string; code: string; organisationId: string },
  ) {
    this.assertOrgStructureManager(req);
    return this.departmentsService.createDepartment(body);
  }

  @Put(':id')
  async updateDepartment(
    @Param('id') id: string,
    @Request() req: { user?: { roles?: string[] } },
    @Body() body: { name?: string; code?: string; defaultWorkflowId?: string | null },
  ) {
    if (body.defaultWorkflowId !== undefined && !hasGodRole(req.user)) {
      throw new ForbiddenException(
        'Only Super Admin or Tech Panel can assign a department default workflow',
      );
    }
    if (
      (body.name !== undefined || body.code !== undefined) &&
      !hasGodRole(req.user)
    ) {
      throw new ForbiddenException(
        'Only Super Admin or Tech Panel can change department name or code',
      );
    }
    return this.departmentsService.updateDepartment(id, body);
  }

  @Delete(':id')
  async deleteDepartment(
    @Request() req: { user?: { roles?: string[] } },
    @Param('id') id: string,
  ) {
    this.assertOrgStructureManager(req);
    return this.departmentsService.deleteDepartment(id);
  }

  @Get(':id/divisions')
  @Header('Cache-Control', 'no-store')
  async getDivisions(@Param('id') departmentId: string, @Request() req) {
    // RBAC: Users can only access divisions from their department (unless super admin or dept admin)
    // Super Admins and Dept Admins can access divisions from any department
    // Other users can only access divisions from their own department
    if (!hasAnyRole(req.user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN'])) {
      if (req.user.departmentId !== departmentId) {
        throw new ForbiddenException('You can only access divisions from your department');
      }
    }
    return this.departmentsService.getDivisions(departmentId);
  }

  @Post(':id/divisions')
  async createDivision(
    @Request() req: { user?: { roles?: string[] } },
    @Param('id') departmentId: string,
    @Body() body: { name: string },
  ) {
    this.assertOrgStructureManager(req);
    return this.departmentsService.createDivision(departmentId, body.name);
  }

  @Get(':id/divisions/:divisionId')
  async getDivisionWithUsers(
    @Param('id') departmentId: string,
    @Param('divisionId') divisionId: string,
    @Request() req,
  ) {
    if (!hasAnyRole(req.user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN'])) {
      if (req.user.departmentId !== departmentId) {
        throw new ForbiddenException('You can only access divisions from your department');
      }
    }
    const division = await this.departmentsService.getDivisionWithUsers(
      departmentId,
      divisionId,
    );
    if (!division) {
      throw new NotFoundException('Division not found');
    }
    return division;
  }

  @Get(':id/divisions/:divisionId/users')
  async getDivisionUsers(
    @Param('id') departmentId: string,
    @Param('divisionId') divisionId: string,
    @Request() req,
  ) {
    // RBAC: Users can only access users from their department (unless super admin)
    if (!hasGodRole(req.user)) {
      // First verify the division belongs to the department
      const division = await this.departmentsService.getDivisionById(divisionId);
      if (!division || division.departmentId !== departmentId) {
        throw new ForbiddenException('Division not found in this department');
      }
      // Then check if user's department matches
      if (req.user.departmentId !== departmentId) {
        throw new ForbiddenException('You can only access users from your department');
      }
    }
    return this.departmentsService.getDivisionUsers(divisionId);
  }
}
