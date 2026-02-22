import { Controller, Get, Put, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DeskProfileService } from './desk-profile.service';
import { DeskProfileQueryDto } from './dto/desk-profile-query.dto';
import { UserRole } from '@prisma/client';

@Controller('desk-profile')
@UseGuards(JwtAuthGuard)
export class DeskProfileController {
  constructor(private readonly deskProfile: DeskProfileService) {}

  @Get('volume')
  getVolume(@Query() q: DeskProfileQueryDto, @Request() req: any) {
    return this.deskProfile.getVolumeStats({
      period: (q.period as any) || 'day',
      deskId: q.deskId,
      departmentId: q.departmentId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      userId: req.user?.id,
      roles: req.user?.roles ?? [],
    });
  }

  @Get('volume/averages')
  getVolumeAverages(@Query() q: DeskProfileQueryDto, @Request() req: any) {
    return this.deskProfile.getVolumeAverages({
      period: (q.period as any) || 'day',
      deskId: q.deskId,
      departmentId: q.departmentId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      roles: req.user?.roles ?? [],
    });
  }

  @Get('time/optimum')
  getOptimumTime(@Request() req: any) {
    return this.deskProfile.getOptimumTimePerFile(req.user?.roles ?? []);
  }

  @Put('time/optimum')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  setOptimumTime(@Body() body: { optimumTimePerFileSeconds: number }, @Request() req: any) {
    return this.deskProfile.setOptimumTimePerFile(body.optimumTimePerFileSeconds, req.user?.roles ?? []);
  }

  @Get('time')
  getTimeStats(
    @Query('fileId') fileId: string | undefined,
    @Query('deskId') deskId: string | undefined,
    @Query('period') period: string | undefined,
    @Request() req: any,
  ) {
    return this.deskProfile.getTimeStats({
      fileId,
      deskId,
      period: (period as any) || 'day',
      roles: req.user?.roles ?? [],
    });
  }

  @Get('files-originated')
  getFilesOriginated(
    @Query('deskId') deskId: string,
    @Query('period') period: string | undefined,
    @Request() req: any,
  ) {
    return this.deskProfile.getFilesOriginatedFromDesk({
      deskId,
      period: period as any,
      roles: req.user?.roles ?? [],
    });
  }

  @Get('login/status')
  getLoginStatus(@Request() req: any) {
    return this.deskProfile.getLoginStatus(req.user?.id, req.user?.roles ?? []);
  }

  @Get('login/time-today')
  getLoginTimeToday(@Request() req: any) {
    return this.deskProfile.getLoginTimeToday(req.user?.id, req.user?.roles ?? []);
  }

  @Get('login/time-period')
  getLoginTimePeriod(@Query() q: DeskProfileQueryDto, @Request() req: any) {
    return this.deskProfile.getLoginTimeForPeriod({
      userId: req.user?.id,
      period: (q.period as any) || 'day',
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      roles: req.user?.roles ?? [],
    });
  }

  @Get('config')
  getConfig(@Request() req: any) {
    return this.deskProfile.getDeskProfileConfig(req.user?.roles ?? []);
  }

  @Put('config')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  setConfig(@Body() body: { loginResetType?: string; officeHoursStart?: string; officeHoursEnd?: string; idleResetMinutes?: number }, @Request() req: any) {
    return this.deskProfile.setDeskProfileConfig(
      {
        loginResetType: body.loginResetType as any,
        officeHoursStart: body.officeHoursStart,
        officeHoursEnd: body.officeHoursEnd,
        idleResetMinutes: body.idleResetMinutes,
      },
      req.user?.roles ?? [],
    );
  }
}
