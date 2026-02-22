import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacityService } from './capacity.service';

@Controller('capacity')
@UseGuards(JwtAuthGuard)
export class CapacityController {
  constructor(private capacityService: CapacityService) {}

  @Get('user/:userId')
  async getUserCapacity(@Param('userId') userId: string) {
    return this.capacityService.getUserCapacity(userId);
  }

  @Get('division/:divisionId')
  async getDivisionCapacity(@Param('divisionId') divisionId: string) {
    return this.capacityService.getDivisionCapacity(divisionId);
  }

  @Get('department/:departmentId')
  async getDepartmentCapacity(@Param('departmentId') departmentId: string) {
    return this.capacityService.getDepartmentCapacity(departmentId);
  }

  @Get('department/:departmentId/hierarchy')
  async getDepartmentHierarchy(@Param('departmentId') departmentId: string) {
    return this.capacityService.getDepartmentCapacityHierarchy(departmentId);
  }

  @Put('user/:userId')
  async setUserCapacity(
    @Param('userId') userId: string,
    @Body() body: { maxFilesPerDay: number },
    @Request() req: any,
  ) {
    return this.capacityService.setUserCapacity(
      userId,
      body.maxFilesPerDay,
      req.user.roles ?? [],
    );
  }

  @Post('users/bulk-update')
  async bulkUpdateUserCapacities(
    @Body()
    body: {
      updates: Array<{ userId: string; maxFilesPerDay: number }>;
    },
    @Request() req: any,
  ) {
    return this.capacityService.bulkUpdateUserCapacities(
      body.updates,
      req.user.roles ?? [],
    );
  }
}

