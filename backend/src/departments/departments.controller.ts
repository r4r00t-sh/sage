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
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

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
    @Body() body: { name: string; code: string; organisationId: string },
  ) {
    return this.departmentsService.createDepartment(body);
  }

  @Put(':id')
  async updateDepartment(
    @Param('id') id: string,
    @Body() body: { name?: string; code?: string },
  ) {
    return this.departmentsService.updateDepartment(id, body);
  }

  @Delete(':id')
  async deleteDepartment(@Param('id') id: string) {
    return this.departmentsService.deleteDepartment(id);
  }

  @Get(':id/divisions')
  @Header('Cache-Control', 'no-store')
  async getDivisions(@Param('id') departmentId: string) {
    return this.departmentsService.getDivisions(departmentId);
  }

  @Post(':id/divisions')
  async createDivision(
    @Param('id') departmentId: string,
    @Body() body: { name: string },
  ) {
    return this.departmentsService.createDivision(departmentId, body.name);
  }

  @Get(':id/divisions/:divisionId/users')
  async getDivisionUsers(
    @Param('id') departmentId: string,
    @Param('divisionId') divisionId: string,
  ) {
    return this.departmentsService.getDivisionUsers(divisionId);
  }
}
